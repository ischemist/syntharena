use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

use assert_cmd::Command;
use flate2::{Compression, write::GzEncoder};
use rusqlite::Connection;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn write_json(path: &Path, value: &Value) -> String {
    let mut bytes = serde_json::to_vec_pretty(value).unwrap();
    bytes.push(b'\n');
    fs::write(path, &bytes).unwrap();
    sha256(&bytes)
}

fn write_gzip(path: &Path, bytes: &[u8]) -> String {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(bytes).unwrap();
    let compressed = encoder.finish().unwrap();
    fs::write(path, &compressed).unwrap();
    sha256(&compressed)
}

fn write_gzip_json(path: &Path, value: &Value) -> String {
    write_gzip(path, &serde_json::to_vec(value).unwrap())
}

fn cli() -> Command {
    Command::cargo_bin("syntharena-corpus-builder").unwrap()
}

fn add_stock(corpus: &Path, artifact: &Path, manifest: &Path, success: bool) {
    let assertion = cli()
        .args(["add-stock", "--corpus"])
        .arg(corpus)
        .args(["--name", "stock", "--artifact"])
        .arg(artifact)
        .arg("--manifest")
        .arg(manifest)
        .assert();
    if success {
        assertion.success();
    } else {
        assertion.failure();
    }
}

fn input_manifest(path: &Path, artifact: &Path, hash: &str, schema: &str) {
    write_json(
        path,
        &json!({
            "schema_version": schema,
            "output_files": [{
                "path": artifact.file_name().unwrap().to_string_lossy(),
                "sha256": hash
            }]
        }),
    );
}

fn bounded_metric(value: f64) -> Value {
    json!({
        "value": value,
        "count": 1,
        "ci_low": value,
        "ci_high": value,
        "reliability": {"code": "OK", "message": "Reliable."}
    })
}

fn fixture_route() -> Value {
    json!({
        "target": {
            "smiles": "CC", "inchikey": "TARGET",
            "product_of": {
                "reactants": [
                    {"smiles": "C", "inchikey": "LEAF", "annotations": {}},
                    {"smiles": "C", "inchikey": "LEAF", "annotations": {}}
                ],
                "mapped_reaction_smiles": "[CH3:1].[CH3:2]>>[CH3:1][CH3:2]",
                "template": "[C:1]-[C:2]>>[C:1].[C:2]",
                "annotations": {"source_id": "fixture-reaction"}
            },
            "annotations": {}
        },
        "annotations": {"planner": "fixture"},
        "schema_version": "2"
    })
}

struct Fixture {
    root: PathBuf,
    stock_artifact: PathBuf,
    stock_manifest: PathBuf,
    benchmark_artifact: PathBuf,
    benchmark_manifest: PathBuf,
    enrichment_artifact: PathBuf,
    enrichment_manifest: PathBuf,
    trust_policy: PathBuf,
    bundle: PathBuf,
    malformed_bundle: PathBuf,
    aliases: PathBuf,
}

fn make_fixture(root: &Path) -> Fixture {
    fs::create_dir_all(root).unwrap();
    let stock_artifact = root.join("stock.csv.gz");
    let stock_hash = write_gzip(&stock_artifact, b"SMILES,InChIKey\nC,LEAF\n");
    let stock_manifest = root.join("stock.manifest.json");
    input_manifest(&stock_manifest, &stock_artifact, &stock_hash, "2");

    let benchmark = json!({
        "name": "bench",
        "description": "One target",
        "stock_name": "stock",
        "targets": {"t1": {
            "id": "t1", "smiles": "CC", "inchikey": "TARGET",
            "acceptable_routes": [fixture_route()], "annotations": {}
        }},
        "default_constraints": [{"kind": "retrocast.stock_termination", "stock": "stock"}],
        "constraints": {}, "annotations": {}, "schema_version": "2"
    });
    let benchmark_artifact = root.join("bench.json.gz");
    let benchmark_hash = write_gzip_json(&benchmark_artifact, &benchmark);
    let benchmark_manifest = root.join("bench.manifest.json");
    input_manifest(
        &benchmark_manifest,
        &benchmark_artifact,
        &benchmark_hash,
        "2",
    );

    let enrichment_artifact = root.join("stock.enrichment.csv.gz");
    let enrichment_hash = write_gzip(
        &enrichment_artifact,
        b"InChIKey,ppg,source,lead_time,link\nLEAF,12.5,MC,1week,https://example.test/leaf\n",
    );
    let enrichment_manifest = root.join("stock.enrichment.manifest.json");
    write_json(
        &enrichment_manifest,
        &json!({
            "schema_version": 1,
            "action": "export-stock-enrichment",
            "stock_name": "stock",
            "source": {"database_sha256": "d".repeat(64), "description": "fixture database"},
            "artifact": {"path": "stock.enrichment.csv.gz", "sha256": enrichment_hash, "rows": 1}
        }),
    );

    let executable = root.join("retrocast-fixture");
    fs::write(&executable, b"reviewed fixture executable").unwrap();
    let executable_hash = sha256(&fs::read(&executable).unwrap());
    let asset_hash = "a".repeat(64);
    let trust_policy = root.join("trust-policy.json");
    write_json(
        &trust_policy,
        &json!({
            "schema_version": 1,
            "retrocast_version": "0.8.3",
            "release_tag": "v0.8.3",
            "release_commit": "33ec506f82d961fad86ddc5260724c45bfcd50e9",
            "release_url": "https://github.com/ischemist/project-procrustes/releases/tag/v0.8.3",
            "approved_assets": [{
                "name": "retrocast-fixture.tar.gz",
                "asset_sha256": asset_hash,
                "executable_sha256": executable_hash
            }]
        }),
    );

    let raw = root.join("route-results.json");
    fs::write(&raw, b"fixture planner result").unwrap();
    let execution = root.join("execution_stats.json");
    fs::write(&execution, b"fixture execution stats").unwrap();
    let bundle = root.join("bundle");
    make_bundle(
        &bundle,
        &raw,
        &execution,
        &stock_artifact,
        &benchmark_artifact,
        &executable,
        &asset_hash,
        false,
    );
    let malformed_bundle = root.join("malformed-bundle");
    make_bundle(
        &malformed_bundle,
        &raw,
        &execution,
        &stock_artifact,
        &benchmark_artifact,
        &executable,
        &asset_hash,
        true,
    );

    let aliases = root.join("aliases.json.gz");
    write_gzip_json(
        &aliases,
        &json!({
            "schema_version": 2,
            "source": {
                "legacy_database_sha256": "e".repeat(64),
                "canonical_database_sha256": "c".repeat(64),
                "rules_sha256": "d".repeat(64),
                "description": "fixture legacy database"
            },
            "benchmark_aliases": [{"alias": "old-benchmark", "benchmark_slug": "bench", "reason": "legacy id"}],
            "prediction_run_aliases": [{"alias": "old-run", "benchmark_slug": "bench", "model_instance_slug": "model-v1", "reason": "legacy id"}],
            "benchmark_target_aliases": [{"alias": "old-target", "benchmark_slug": "bench", "target_id": "t1", "reason": "legacy id"}]
        }),
    );

    Fixture {
        root: root.to_owned(),
        stock_artifact,
        stock_manifest,
        benchmark_artifact,
        benchmark_manifest,
        enrichment_artifact,
        enrichment_manifest,
        trust_policy,
        bundle,
        malformed_bundle,
        aliases,
    }
}

#[allow(clippy::too_many_arguments)]
fn make_bundle(
    bundle: &Path,
    raw: &Path,
    execution: &Path,
    stock: &Path,
    benchmark: &Path,
    executable: &Path,
    asset_hash: &str,
    corrupt_candidate: bool,
) {
    fs::create_dir(bundle).unwrap();
    let route = fixture_route();
    let success = json!({"rank": 1, "route": route.clone()});
    let failure = json!({"rank": 2, "failure": {"code": "adapter.failure", "context": {}}});
    let candidates_path = bundle.join("candidates.json.gz");
    let candidates_hash =
        write_gzip_json(&candidates_path, &json!({"t1": [success, failure.clone()]}));
    let target = json!({
        "id": "t1", "smiles": "CC", "inchikey": "TARGET",
        "acceptable_routes": [route.clone()], "annotations": {}
    });
    let scored_success = json!({
        "rank": 1,
        "route": route,
        "validity": {"tiers": {"0": {"status": "pass", "checks": []}}},
        "constraints": {"status": "pass", "checks": []},
        "matches_acceptable": true,
        "matched_acceptable_index": 0
    });
    let scored_failure = json!({
        "rank": 2,
        "failure": {"code": "adapter.failure", "context": {}},
        "validity": {"tiers": {"0": {"status": "fail", "checks": [
            {"code": "adapter.failure", "status": "fail", "details": {}}
        ]}}},
        "constraints": {"status": "not_evaluated", "checks": []},
        "matches_acceptable": false
    });
    let constraint = json!({"kind": "retrocast.stock_termination", "stock": "stock"});
    let task = json!({
        "name": "bench", "description": "One target", "targets": {"t1": target.clone()},
        "default_constraints": [constraint.clone()], "constraints": {},
        "annotations": {}, "schema_version": "2"
    });
    let evaluation_text = format!(
        "{{\"task\":{},\"tiers\":[0],\"metric_label\":\"stock\",\"acceptable_match_level\":\"full\",\"acceptable_route_match\":\"prefix\",\"targets\":{{\"t1\":{{\"target\":{},\"effective_constraints\":[{}],\"candidates\":[{},{}],\"wall_time\":0.5,\"cpu_time\":0.25}}}},\"schema_version\":\"2\"}}",
        task, target, constraint, scored_success, scored_failure
    );
    let evaluation_path = bundle.join("evaluation.json.gz");
    let evaluation_hash = write_gzip(&evaluation_path, evaluation_text.as_bytes());
    let mut metrics = serde_json::Map::new();
    for key in [
        "tier_0_validity_rate",
        "tier_0_validity_mrr",
        "solv_0[stock]_rate",
        "solv_0[stock]_mrr",
        "acceptable_reconstruction_top_1[stock]",
        "acceptable_reconstruction_top_3[stock]",
        "acceptable_reconstruction_top_5[stock]",
        "acceptable_reconstruction_top_10[stock]",
        "acceptable_reconstruction_top_20[stock]",
        "acceptable_reconstruction_top_50[stock]",
        "acceptable_reconstruction_top_100[stock]",
    ] {
        metrics.insert(key.to_owned(), bounded_metric(1.0));
    }
    let analysis_path = bundle.join("analysis.json.gz");
    let analysis_hash = write_gzip_json(
        &analysis_path,
        &json!({
            "schema_version": "2", "metrics": metrics.clone(), "by_stratum": {"depth 1": metrics},
            "bootstrap_resamples": 1,
            "runtime": {"total_wall_time": 0.5, "mean_wall_time": 0.5,
                "total_cpu_time": 0.25, "mean_cpu_time": 0.25, "timed_target_count": 1}
        }),
    );
    let run_path = bundle.join("evaluation-run.json");
    let run_hash = write_json(
        &run_path,
        &json!({
            "engine": "rust", "workers": 1, "targets": 1, "candidates": 2,
            "ingest_seconds": 0.1, "score_seconds": 0.1, "analyze_seconds": 0.1,
            "total_seconds": 0.3, "targets_per_second": 3.0, "candidates_per_second": 6.0
        }),
    );
    write_json(
        &bundle.join("producer.json"),
        &json!({
            "engine": "Rust standalone CLI",
            "executable_path": executable,
            "executable_sha256": sha256(&fs::read(executable).unwrap()),
            "release_asset": "retrocast-fixture.tar.gz",
            "release_asset_sha256": asset_hash,
            "release_commit": "33ec506f82d961fad86ddc5260724c45bfcd50e9",
            "release_tag": "v0.8.3",
            "release_url": "https://github.com/ischemist/project-procrustes/releases/tag/v0.8.3",
            "retrocast_version": "0.8.3"
        }),
    );
    let source = |path: &Path| json!({"path": path, "sha256": sha256(&fs::read(path).unwrap())});
    write_json(
        &bundle.join("manifest.json"),
        &json!({
            "schema_version": "2", "retrocast_version": "0.8.3",
            "created_at": "2026-08-04T00:00:00Z", "action": "evaluate:v2",
            "parameters": {"adapter": "fixture", "mode": "strict", "workers": 1,
                "match_level": "full", "acceptable_route_match": "prefix", "n_boot": 1, "seed": 42},
            "directives": {},
            "source_files": [source(raw), source(benchmark), source(stock), source(execution)],
            "output_files": [
                {"path": "candidates.json.gz", "sha256": candidates_hash},
                {"path": "evaluation.json.gz", "sha256": evaluation_hash},
                {"path": "analysis.json.gz", "sha256": analysis_hash},
                {"path": "evaluation-run.json", "sha256": run_hash}
            ],
            "statistics": {"targets": 1, "candidates": 2}, "summary": {}
        }),
    );
    if corrupt_candidate {
        fs::OpenOptions::new()
            .append(true)
            .open(candidates_path)
            .unwrap()
            .write_all(b"corrupt")
            .unwrap();
    }
}

#[test]
fn complete_cli_workflow_is_retry_safe_and_builds_prisma_readable_sqlite() {
    let directory = tempfile::tempdir().unwrap();
    let fixture = make_fixture(&directory.path().join("source"));
    let corpus = directory.path().join("corpus");
    cli()
        .args(["init", "--corpus"])
        .arg(&corpus)
        .assert()
        .success();

    let bad_stock = fixture.root.join("bad-stock.csv.gz");
    let bad_hash = write_gzip(&bad_stock, b"wrong,headers\nC,LEAF\n");
    let bad_manifest = fixture.root.join("bad-stock.manifest.json");
    input_manifest(&bad_manifest, &bad_stock, &bad_hash, "2");
    add_stock(&corpus, &bad_stock, &bad_manifest, false);
    assert!(!corpus.join("inputs/stocks/stock.csv.gz").exists());
    add_stock(
        &corpus,
        &fixture.stock_artifact,
        &fixture.stock_manifest,
        true,
    );

    cli()
        .args(["add-stock-enrichment", "--corpus"])
        .arg(&corpus)
        .args(["--stock", "stock", "--artifact"])
        .arg(&fixture.enrichment_artifact)
        .arg("--manifest")
        .arg(&fixture.enrichment_manifest)
        .assert()
        .success();
    cli()
        .args(["add-benchmark", "--corpus"])
        .arg(&corpus)
        .args(["--stock", "stock", "--series", "other", "--artifact"])
        .arg(&fixture.benchmark_artifact)
        .arg("--manifest")
        .arg(&fixture.benchmark_manifest)
        .assert()
        .success();
    cli()
        .args(["add-model", "--corpus"])
        .arg(&corpus)
        .args([
            "--key",
            "workspace-model",
            "--algorithm-name",
            "Fixture",
            "--algorithm-slug",
            "fixture",
            "--family-name",
            "Fixture Family",
            "--family-slug",
            "fixture-family",
            "--instance-slug",
            "model-v1",
            "--version",
            "1.0.0",
            "--default-hourly-cost-usd",
            "2.0",
        ])
        .assert()
        .success();
    cli()
        .args(["trust-policy", "--corpus"])
        .arg(&corpus)
        .arg("--policy")
        .arg(&fixture.trust_policy)
        .assert()
        .success();

    cli()
        .args(["add-run", "--corpus"])
        .arg(&corpus)
        .args([
            "--benchmark",
            "bench",
            "--model",
            "workspace-model",
            "--hourly-cost-usd",
            "4.0",
            "--bundle",
        ])
        .arg(&fixture.malformed_bundle)
        .assert()
        .failure();
    assert!(!corpus.join("bundles/bench/workspace-model").exists());
    cli()
        .args(["add-run", "--corpus"])
        .arg(&corpus)
        .args([
            "--benchmark",
            "bench",
            "--model",
            "workspace-model",
            "--hourly-cost-usd",
            "4.0",
            "--bundle",
        ])
        .arg(&fixture.bundle)
        .assert()
        .success();
    cli()
        .args(["coverage", "--corpus"])
        .arg(&corpus)
        .args(["--mode", "cross-product"])
        .assert()
        .success();
    cli()
        .args(["aliases", "--corpus"])
        .arg(&corpus)
        .arg("--artifact")
        .arg(&fixture.aliases)
        .assert()
        .success();
    cli()
        .args(["validate", "--corpus"])
        .arg(&corpus)
        .assert()
        .success();
    let registered_candidates = corpus.join("bundles/bench/workspace-model/candidates.json.gz");
    let candidate_bytes = fs::read(&registered_candidates).unwrap();
    fs::OpenOptions::new()
        .append(true)
        .open(&registered_candidates)
        .unwrap()
        .write_all(b"tamper")
        .unwrap();
    cli()
        .args(["validate", "--corpus"])
        .arg(&corpus)
        .assert()
        .failure();
    fs::write(&registered_candidates, candidate_bytes).unwrap();
    cli()
        .args(["validate", "--corpus"])
        .arg(&corpus)
        .assert()
        .success();

    let database = directory.path().join("corpus.db");
    cli()
        .arg("build")
        .arg("--corpus")
        .arg(&corpus)
        .arg("--output")
        .arg(&database)
        .assert()
        .success();
    let connection = Connection::open(&database).unwrap();
    let benchmark_artifact_sha256 = sha256(&fs::read(&fixture.benchmark_artifact).unwrap());
    assert_eq!(
        connection
            .query_row(
                "SELECT id FROM BenchmarkSet WHERE slug = 'bench'",
                [],
                |r| { r.get::<_, String>(0) }
            )
            .unwrap(),
        benchmark_artifact_sha256
    );
    assert_eq!(
        connection
            .query_row("SELECT importedRunCount FROM DatabaseMetadata", [], |r| r
                .get::<_, i64>(
                0
            ))
            .unwrap(),
        1
    );
    let cost: (f64, f64) = connection
        .query_row("SELECT hourlyCost, totalCost FROM PredictionRun", [], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .unwrap();
    assert_eq!(cost.0, 4.0);
    assert!((cost.1 - 4.0 * (0.5 / 3600.0)).abs() < f64::EPSILON);
    assert_eq!(
        connection
            .query_row("SELECT ppg FROM StockItem", [], |r| r.get::<_, f64>(0))
            .unwrap(),
        12.5
    );
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM RouteNode", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        3
    );
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM RouteNodePayload", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        2
    );
    let topology: (i64, i64) = connection
        .query_row(
            "SELECT COUNT(parentId), COUNT(DISTINCT parentId) FROM RouteNode",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(topology, (2, 1));
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM AcceptableRoute", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        1
    );
    assert_eq!(
        connection
            .query_row(
                "SELECT value FROM MetricEstimate WHERE metricKey = 'solv_0[stock]_rate' AND stratum = ''",
                [],
                |r| r.get::<_, f64>(0),
            )
            .unwrap(),
        1.0
    );
    let evidence: (i64, i64, i64, i64) = connection
        .query_row(
            "SELECT
                (SELECT COUNT(*) FROM CandidateTierResult WHERE status='PASS'),
                (SELECT COUNT(*) FROM CandidateTierResult WHERE status='FAIL'),
                (SELECT COUNT(*) FROM CandidateEvaluation WHERE constraintStatus='PASS'),
                (SELECT COUNT(*) FROM CandidateEvaluation WHERE constraintStatus='NOT_EVALUATED')",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .unwrap();
    assert_eq!(evidence, (1, 1, 1, 1));
    assert_eq!(
        connection
            .query_row(
                "SELECT reason FROM PredictionRunUrlAlias WHERE alias='old-run'",
                [],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        "legacy id"
    );
    let stored_manifest: String = connection
        .query_row("SELECT manifestJson FROM RunEvaluation", [], |r| r.get(0))
        .unwrap();
    assert!(!stored_manifest.contains(directory.path().to_str().unwrap()));
    assert!(stored_manifest.contains("external/route-results.json"));
    let execution_stats_path: String = connection
        .query_row("SELECT executionStatsPath FROM PredictionRun", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(execution_stats_path, "external/execution_stats.json");
    let migration_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM _prisma_migrations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(migration_count, 1);
    drop(connection);

    let continuity = directory.path().join("continuity.db");
    cli()
        .arg("build")
        .arg("--corpus")
        .arg(&corpus)
        .arg("--output")
        .arg(&continuity)
        .arg("--identity-baseline")
        .arg(&database)
        .assert()
        .success();
    let continuity_connection = Connection::open(&continuity).unwrap();
    let baseline_hash: String = continuity_connection
        .query_row(
            "SELECT identityBaselineSha256 FROM DatabaseMetadata",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(baseline_hash, sha256(&fs::read(&database).unwrap()));

    let catalog_path = corpus.join("catalog.json");
    let mut catalog: Value = serde_json::from_slice(&fs::read(&catalog_path).unwrap()).unwrap();
    catalog["models"][0]["family_name"] = json!("Scientifically changed family");
    write_json(&catalog_path, &catalog);
    let rejected = directory.path().join("rejected.db");
    cli()
        .arg("build")
        .arg("--corpus")
        .arg(&corpus)
        .arg("--output")
        .arg(&rejected)
        .arg("--identity-baseline")
        .arg(&database)
        .assert()
        .failure();
    assert!(!rejected.exists());
}

#[test]
fn derives_deterministic_compressed_aliases_from_explicit_rules() {
    let directory = tempfile::tempdir().unwrap();
    let legacy_path = directory.path().join("legacy.db");
    let canonical_path = directory.path().join("canonical.db");
    let rules_path = directory.path().join("rules.json");
    let output_path = directory.path().join("aliases.json.gz");
    let second_output_path = directory.path().join("aliases-again.json.gz");

    let legacy = Connection::open(&legacy_path).unwrap();
    legacy
        .execute_batch(
            "CREATE TABLE BenchmarkSet (id TEXT PRIMARY KEY, name TEXT NOT NULL);
             CREATE TABLE BenchmarkTarget (id TEXT PRIMARY KEY, benchmarkSetId TEXT NOT NULL, targetId TEXT NOT NULL);
             CREATE TABLE ModelInstance (id TEXT PRIMARY KEY, slug TEXT NOT NULL);
             CREATE TABLE PredictionRun (id TEXT PRIMARY KEY, benchmarkSetId TEXT NOT NULL, modelInstanceId TEXT NOT NULL);
             INSERT INTO BenchmarkSet VALUES ('old-benchmark', 'bench-single-gt');
             INSERT INTO BenchmarkTarget VALUES ('old-target', 'old-benchmark', 't1');
             INSERT INTO ModelInstance VALUES ('old-model', 'model-v9');
             INSERT INTO PredictionRun VALUES ('old-run', 'old-benchmark', 'old-model');",
        )
        .unwrap();
    drop(legacy);

    let canonical = Connection::open(&canonical_path).unwrap();
    canonical
        .execute_batch(
            "CREATE TABLE BenchmarkSet (id TEXT PRIMARY KEY, slug TEXT NOT NULL);
             CREATE TABLE BenchmarkTarget (id TEXT PRIMARY KEY, benchmarkSetId TEXT NOT NULL, targetId TEXT NOT NULL);
             CREATE TABLE ModelInstance (id TEXT PRIMARY KEY, slug TEXT NOT NULL);
             CREATE TABLE PredictionRun (id TEXT PRIMARY KEY, benchmarkSetId TEXT NOT NULL, modelInstanceId TEXT NOT NULL);
             INSERT INTO BenchmarkSet VALUES ('canonical-benchmark', 'bench');
             INSERT INTO BenchmarkTarget VALUES ('canonical-target', 'canonical-benchmark', 't1');
             INSERT INTO ModelInstance VALUES ('canonical-model', 'model-v1');
             INSERT INTO PredictionRun VALUES ('canonical-run', 'canonical-benchmark', 'canonical-model');",
        )
        .unwrap();
    drop(canonical);

    write_json(
        &rules_path,
        &json!({
            "schema_version": 1,
            "benchmark_slugs": [{"from": "bench-single-gt", "to": "bench", "reason": "single-gt-fold"}],
            "model_instance_slugs": [{"from": "model-v9", "to": "model-v1", "reason": "corrected-model-version"}]
        }),
    );
    cli()
        .arg("derive-aliases")
        .arg("--legacy-database")
        .arg(&legacy_path)
        .arg("--canonical-database")
        .arg(&canonical_path)
        .arg("--rules")
        .arg(&rules_path)
        .arg("--output")
        .arg(&output_path)
        .args(["--source-description", "published fixture database"])
        .assert()
        .success();

    let compressed = fs::read(&output_path).unwrap();
    let mut decoder = flate2::read::GzDecoder::new(compressed.as_slice());
    let mut bytes = Vec::new();
    decoder.read_to_end(&mut bytes).unwrap();
    let manifest: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(manifest["schema_version"], 2);
    assert_eq!(
        manifest["source"]["legacy_database_sha256"],
        sha256(&fs::read(&legacy_path).unwrap())
    );
    assert_eq!(
        manifest["source"]["canonical_database_sha256"],
        sha256(&fs::read(&canonical_path).unwrap())
    );
    assert_eq!(
        manifest["source"]["rules_sha256"],
        sha256(&fs::read(&rules_path).unwrap())
    );
    assert_eq!(manifest["benchmark_aliases"][0]["alias"], "old-benchmark");
    assert_eq!(
        manifest["benchmark_target_aliases"][0]["alias"],
        "old-target"
    );
    assert_eq!(manifest["prediction_run_aliases"][0]["alias"], "old-run");
    assert_eq!(
        manifest["prediction_run_aliases"][0]["reason"],
        "single-gt-fold+corrected-model-version"
    );

    cli()
        .arg("derive-aliases")
        .arg("--legacy-database")
        .arg(&legacy_path)
        .arg("--canonical-database")
        .arg(&canonical_path)
        .arg("--rules")
        .arg(&rules_path)
        .arg("--output")
        .arg(&second_output_path)
        .args(["--source-description", "published fixture database"])
        .assert()
        .success();
    assert_eq!(compressed, fs::read(second_output_path).unwrap());

    cli()
        .arg("derive-aliases")
        .arg("--legacy-database")
        .arg(&legacy_path)
        .arg("--canonical-database")
        .arg(&canonical_path)
        .arg("--rules")
        .arg(&rules_path)
        .arg("--output")
        .arg(&output_path)
        .args(["--source-description", "published fixture database"])
        .assert()
        .failure();
}
