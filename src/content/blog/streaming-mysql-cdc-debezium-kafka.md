---
title: 'Streaming MySQL to Our Data Platform in Near Real-Time with Debezium and Kafka'
description: "How we replaced stale batch pipelines with change data capture — what we tried, what we settled on, where it still bites us, and where we're taking it next."
pubDate: 2026-08-07
tags: ['Data Engineering', 'CDC', 'Debezium', 'Kafka', 'MySQL']
readingTime: '10 min read'
draft: false
---

## The problem: our data was fresh in the OLTP, stale everywhere else

Most of our user-facing applications sit on top of MySQL. That's great for transactions — but every downstream consumer that needed that data (our Data Platform, fStream, various analytics and computation jobs) was working off data that was hours behind reality.

The gap came from *how* we were moving data out of MySQL. Whatever we did, the same data ended up being served two very different ways: fast and consistent inside the OLTP, slow and stale everywhere else.

The goal of this project was simple to state and annoying to deliver: **make row-level changes in our MySQL databases available to downstream pipelines in near real-time, without hammering the source databases or rewriting every application.**

By the end of this post you'll see the approaches we ruled out, why we landed on Debezium-based Change Data Capture (CDC), how the pipeline actually fits together, the failure modes we've learned to respect, and what's still on the roadmap.

---

## What we needed (the actual requirements)

Before comparing options, we pinned down what "good" meant:

- **Near real-time.** Seconds-to-low-minutes of lag, not hours.
- **Low load on the source.** The OLTP is serving production traffic. The pipeline can't compete with it.
- **Capture everything — including deletes.** Inserts, updates, *and* hard deletes, in the order they happened.
- **No invasive application changes.** We had many frontend apps on these databases. Retrofitting each one was a non-starter.
- **Replayable and decoupled.** Downstream consumers should be able to read at their own pace and re-read history if needed.

Keep these five in mind — every rejected approach failed at least one of them.

---

## What we tried (and why we walked away)

### Attempt 1: Scheduled batch dumps / nightly ETL

The simplest thing that could possibly work: periodically snapshot the tables and ship them downstream.

It fell over on two of our requirements at once. Freshness was measured in hours, not seconds. And every run put a heavy read load on the source right when we least wanted it. Worst of all, **deletes were invisible** — a row that disappeared between two dumps just silently vanished, and reconstructing *when* it left was impossible.

### Attempt 2: Timestamp polling (`WHERE updated_at > last_run`)

The next step up: poll each table for rows changed since the last checkpoint.

Better freshness, but it inherited batch's fatal flaws and added new ones. It still **couldn't see hard deletes** (a deleted row has no `updated_at` to compare against). It demanded that *every* table carry a reliable, indexed `updated_at` column — a discipline our schemas didn't uniformly follow. And tightening the poll interval to chase real-time just meant more query load on the OLTP.

### Attempt 3: Dual writes from the application

What if the app just wrote to MySQL *and* published an event to Kafka?

This is a classic trap. You now have **two systems that must both succeed or both fail**, with no transaction spanning them — so any crash between the two writes leaves the DB and the stream disagreeing. It also couples every application to the messaging layer, which directly violated our "no invasive app changes" requirement across a fleet of frontends.

### Attempt 4: Change Data Capture from the binlog ✅

MySQL already writes an ordered, durable record of every committed change: the **binary log (binlog)**. It's the same mechanism replicas use to stay in sync. If we could read the binlog instead of querying tables, we'd get every change — including deletes — in commit order, with almost no additional load on the source, and zero application changes.

That's exactly what **Debezium** does.

---

## Why we settled on Debezium + Kafka Connect

[Debezium](https://debezium.io/) is a distributed CDC platform. Its MySQL connector runs inside **Kafka Connect** as a *source connector*: it reads the binlog in near real-time and publishes each row-level change as an event to Kafka. It can also take an initial **snapshot** of existing data so consumers start from a complete picture, not just changes-from-now.

It checked every box:

| Requirement | How CDC / Debezium satisfies it |
|---|---|
| Near real-time | Reads the binlog as changes commit — sub-second to seconds of lag |
| Low source load | Reads the log, doesn't query tables; looks like just another replica |
| Captures deletes + order | The binlog *is* the ordered truth, deletes included |
| No app changes | Reads infrastructure the DB already produces; apps are untouched |
| Replayable + decoupled | Kafka retains events; consumers read independently at their own offset |

Kafka Connect gave us the operational frame around it — a place to run connectors, manage them over a REST API, and split each job into parallel **tasks**. Connectors come in two flavours: **source** (into Kafka) and **sink** (out of Kafka). Debezium is the source; downstream we use sink connectors or fStream jobs.

The point worth making to a reader: **we didn't pick Debezium because it was trendy — we picked the binlog, and Debezium is the cleanest way to consume it.**

---

## How the pipeline actually fits together

Here's the end-to-end flow:

```
Source MySQL
    │  (binlog)
    ▼
Debezium Connector  ──►  One Kafka topic per database  (db.all_tables)
                                    │
                                    ▼
                            Debezium Helper  (enrich + fan out by table)
                                    │
                                    ▼
                         One Kafka topic per table  (<server>.<db>.<table>)
                              │                       │
                              ▼                       ▼
                        FLAT Ingestion          ADM Computation
```

A few things worth calling out:

- **One connector per server, two environments.** We created logical connectors for the entities on each server, one set for **prod** (productionisation) and one for **stage** (pre-prod testing). Connectors are created by POSTing config to the Kafka Connect REST API, and validated via the status API plus a Kafka console-consumer job to eyeball the messages.
- **Everything lands in one topic first.** When the connector runs, all changes from the whitelisted tables flow into a single per-database topic.
- **A Debezium Helper fans out per table.** This internal component reads that firehose, enriches the records, and splits them into one topic per table, named `<database.server.name>.<db>.<table>`. Downstream systems subscribe to just the tables they care about.
- **Consumers transform and re-emit.** A sink connector or fStream job transforms events and writes them to the HTTP Ingestion API or Ingestion Kafka clusters.

### The setup gotchas nobody warns you about

Two configuration details are load-bearing, and both live on the MySQL side:

1. **Row-level binary logging must be on.** CDC reads the binlog; if it's off or set to `STATEMENT` format, there's nothing useful to read. You need `binlog_format = ROW`.
2. **The connector's DB user needs specific grants** on every monitored database: `SELECT`, `RELOAD`, `SHOW DATABASES`, `REPLICATION SLAVE`, and `REPLICATION CLIENT`. Miss one and the connector fails in ways that aren't always obvious from the error.

### What a change event actually looks like

Each record has two parts: a **schema** and a **payload**. The payload carries the `before` and `after` state of the row (so on an update or delete you can see exactly what changed), plus an `op` field telling you whether it was an insert (`c`), update (`u`), or delete (`d`), and source metadata like the database, table, and binlog position.

```json
{
  "schema": { "...": "..." },
  "payload": {
    "before": { "id": 1004, "first_name": "Anne",       "last_name": "Kretchmar" },
    "after":  { "id": 1004, "first_name": "Anne Marie", "last_name": "Kretchmar" },
    "source": { "db": "inventory", "table": "customers", "file": "mysql-bin.000003", "pos": 484 },
    "op": "u",
    "ts_ms": 1465581029523
  }
}
```

That `before`/`after`/`op` shape is what makes CDC so powerful downstream — consumers can reconstruct exact state transitions, not just current values.

---

## Where this solution can break

CDC is not magic. Here are the sharp edges we've learned to respect:

**Binlog retention vs. connector downtime.** The connector tracks its position in the binlog. If it's down longer than MySQL keeps its binlogs (`binlog_expire_logs_seconds`), its position expires and it's forced into a full re-snapshot — expensive, and a freshness gap while it catches up. Retention and alerting on connector lag are not optional.

**The initial snapshot.** Snapshotting large tables is heavy and slow, and depending on config can hold locks or load the source. Onboarding a big new table is a planned operation, not a config toggle.

**Schema changes and online DDL.** Tools like `gh-ost` / `pt-online-schema-change` create shadow tables and swap them in. CDC pipelines can get confused by this, and the schema-history topic that Debezium relies on must stay intact — corrupt or lose it and the connector can't interpret the binlog.

**Primary failover.** If MySQL fails over to a replica, binlog file names and positions differ. Without **GTID-based** tracking, the connector can end up lost or replaying. Plan your failover story explicitly.

**The Debezium Helper is a single point in the path.** Routing everything through one per-database topic and then fanning out via a custom Helper means the Helper is both a potential **bottleneck** and a **single point of failure**. A flood of changes (bulk update, backfill) upstream becomes backpressure that the Helper — and everything behind it — has to absorb. *(Worth asking whether the fan-out even needs to be custom — see next steps.)*

**Ordering is only per-key.** Kafka preserves order within a partition, i.e. per primary key. Cross-row or cross-table ordering is not guaranteed once you're past the single-topic stage. Consumers that assume global ordering will eventually be wrong.

**At-least-once, not exactly-once.** On restarts, the connector can re-emit events. Downstream consumers must be **idempotent** or you'll double-count.

**Poison messages.** A record a consumer can't deserialize can stall a partition unless you have a dead-letter path.

---

## What's next

- **Automate connector provisioning.** Creating connectors by hand-POSTing config doesn't scale and drifts between prod and stage. Move it into version-controlled, automated deployment.
- **Adopt a Schema Registry (Avro/Protobuf).** Embedding the full JSON schema in every message is verbose and brittle. A registry shrinks payloads and makes schema evolution safe and explicit.
- **Reconsider the custom Helper.** Debezium can route changes to per-table topics natively via topic-routing SMTs. If we can push enrichment into Single Message Transforms or the sink, we remove a bespoke bottleneck and SPOF from the critical path.
- **Real monitoring and alerting.** Connector status, end-to-end lag, and — critically — *binlog-position age* versus retention. We want to know we're falling behind long before a forced re-snapshot.
- **Dead-letter queue** for poison messages so one bad record can't stall a partition.
- **GTID-based tracking** to survive primary failover cleanly.
- **Incremental snapshots** (Debezium signals) so onboarding new tables doesn't mean a disruptive full snapshot.

---

## Takeaways

If you're moving OLTP data to analytics and reaching for a nightly batch job or a polling query, stop and look at the binlog first. CDC gave us near-real-time data, captured deletes, kept load off the source, and required zero application changes — a combination none of the alternatives could match.

But "read the log" is the easy part. The engineering is in the operational edges: retention, snapshots, schema evolution, failover, and backpressure. Get those right and CDC is transformative. Ignore them and you've just built a faster way to page yourself at 2am.
