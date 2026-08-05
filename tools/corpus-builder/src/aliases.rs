use std::{
    collections::{HashMap, HashSet},
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, bail};
use flate2::{Compression, GzBuilder, read::GzDecoder};
use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use tempfile::Builder as TempBuilder;

const MAX_DECOMPRESSED_ALIAS_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Clone, Debug)]
pub struct DeriveLegacyUrlAliasesOptions {
    pub legacy_database: PathBuf,
    pub canonical_database: PathBuf,
    pub rules: PathBuf,
    pub output: PathBuf,
    pub source_description: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct LegacyUrlAliasManifest {
    pub(crate) schema_version: u8,
    pub(crate) source: LegacyAliasSource,
    #[serde(default)]
    pub(crate) benchmark_aliases: Vec<BenchmarkAlias>,
    #[serde(default)]
    pub(crate) prediction_run_aliases: Vec<PredictionRunAlias>,
    #[serde(default)]
    pub(crate) benchmark_target_aliases: Vec<BenchmarkTargetAlias>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct LegacyAliasSource {
    pub(crate) legacy_database_sha256: String,
    pub(crate) canonical_database_sha256: String,
    pub(crate) rules_sha256: String,
    pub(crate) description: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct BenchmarkAlias {
    pub(crate) alias: String,
    pub(crate) benchmark_slug: String,
    pub(crate) reason: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct PredictionRunAlias {
    pub(crate) alias: String,
    pub(crate) benchmark_slug: String,
    pub(crate) model_instance_slug: String,
    pub(crate) reason: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct BenchmarkTargetAlias {
    pub(crate) alias: String,
    pub(crate) benchmark_slug: String,
    pub(crate) target_id: String,
    pub(crate) reason: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct AliasRules {
    schema_version: u8,
    #[serde(default)]
    benchmark_slugs: Vec<AliasRule>,
    #[serde(default)]
    model_instance_slugs: Vec<AliasRule>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct AliasRule {
    from: String,
    to: String,
    reason: String,
}

#[derive(Debug)]
struct LegacyBenchmark {
    id: String,
    name: String,
}

#[derive(Debug)]
struct LegacyTarget {
    id: String,
    benchmark_name: String,
    target_id: String,
}

#[derive(Debug)]
struct LegacyRun {
    id: String,
    benchmark_name: String,
    model_instance_slug: String,
}

pub fn derive_legacy_url_aliases(options: DeriveLegacyUrlAliasesOptions) -> Result<()> {
    if options.source_description.trim().is_empty() {
        bail!("--source-description must not be empty");
    }
    if !options.output.to_string_lossy().ends_with(".json.gz") {
        bail!("--output must end in .json.gz");
    }
    if options.output.exists() {
        bail!("output already exists: {}", options.output.display());
    }

    let rules: AliasRules = serde_json::from_slice(
        &fs::read(&options.rules)
            .with_context(|| format!("read alias rules {}", options.rules.display()))?,
    )
    .with_context(|| format!("parse alias rules {}", options.rules.display()))?;
    let (benchmark_rules, model_rules) = validate_rules(rules)?;
    let legacy = open_read_only(&options.legacy_database, "legacy")?;
    let canonical = open_read_only(&options.canonical_database, "canonical")?;

    let canonical_benchmarks = canonical
        .prepare("SELECT slug FROM BenchmarkSet")?
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<HashSet<_>>>()?;
    let canonical_targets = canonical
        .prepare(
            "SELECT BenchmarkSet.slug, BenchmarkTarget.targetId FROM BenchmarkTarget JOIN BenchmarkSet ON BenchmarkSet.id = BenchmarkTarget.benchmarkSetId",
        )?
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?
        .collect::<rusqlite::Result<HashSet<_>>>()?;
    let canonical_runs = canonical
        .prepare(
            "SELECT BenchmarkSet.slug, ModelInstance.slug FROM PredictionRun JOIN BenchmarkSet ON BenchmarkSet.id = PredictionRun.benchmarkSetId JOIN ModelInstance ON ModelInstance.id = PredictionRun.modelInstanceId",
        )?
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?
        .collect::<rusqlite::Result<HashSet<_>>>()?;

    let legacy_benchmarks = legacy
        .prepare("SELECT id, name FROM BenchmarkSet ORDER BY id")?
        .query_map([], |row| {
            Ok(LegacyBenchmark {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let legacy_targets = legacy
        .prepare(
            "SELECT BenchmarkTarget.id, BenchmarkSet.name, BenchmarkTarget.targetId FROM BenchmarkTarget JOIN BenchmarkSet ON BenchmarkSet.id = BenchmarkTarget.benchmarkSetId ORDER BY BenchmarkTarget.id",
        )?
        .query_map([], |row| {
            Ok(LegacyTarget {
                id: row.get(0)?,
                benchmark_name: row.get(1)?,
                target_id: row.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let legacy_runs = legacy
        .prepare(
            "SELECT PredictionRun.id, BenchmarkSet.name, ModelInstance.slug FROM PredictionRun JOIN BenchmarkSet ON BenchmarkSet.id = PredictionRun.benchmarkSetId JOIN ModelInstance ON ModelInstance.id = PredictionRun.modelInstanceId ORDER BY PredictionRun.id",
        )?
        .query_map([], |row| {
            Ok(LegacyRun {
                id: row.get(0)?,
                benchmark_name: row.get(1)?,
                model_instance_slug: row.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut used_benchmark_rules = HashSet::new();
    let mut used_model_rules = HashSet::new();
    let mut benchmark_aliases = Vec::with_capacity(legacy_benchmarks.len());
    for row in legacy_benchmarks {
        let (benchmark_slug, reason) =
            apply_rule(&row.name, &benchmark_rules, &mut used_benchmark_rules);
        if !canonical_benchmarks.contains(benchmark_slug) {
            bail!("no canonical benchmark destination for {}", row.name);
        }
        benchmark_aliases.push(BenchmarkAlias {
            alias: row.id,
            benchmark_slug: benchmark_slug.to_owned(),
            reason: reason.unwrap_or("identity").to_owned(),
        });
    }

    let mut benchmark_target_aliases = Vec::with_capacity(legacy_targets.len());
    for row in legacy_targets {
        let (benchmark_slug, benchmark_reason) = apply_rule(
            &row.benchmark_name,
            &benchmark_rules,
            &mut used_benchmark_rules,
        );
        if !canonical_targets.contains(&(benchmark_slug.to_owned(), row.target_id.clone())) {
            bail!(
                "no canonical target destination for {}/{}",
                row.benchmark_name,
                row.target_id
            );
        }
        benchmark_target_aliases.push(BenchmarkTargetAlias {
            alias: row.id,
            benchmark_slug: benchmark_slug.to_owned(),
            target_id: row.target_id,
            reason: benchmark_reason.unwrap_or("identity").to_owned(),
        });
    }

    let mut prediction_run_aliases = Vec::with_capacity(legacy_runs.len());
    for row in legacy_runs {
        let (benchmark_slug, benchmark_reason) = apply_rule(
            &row.benchmark_name,
            &benchmark_rules,
            &mut used_benchmark_rules,
        );
        let (model_instance_slug, model_reason) = apply_rule(
            &row.model_instance_slug,
            &model_rules,
            &mut used_model_rules,
        );
        if !canonical_runs.contains(&(benchmark_slug.to_owned(), model_instance_slug.to_owned())) {
            bail!(
                "no canonical run destination for {}/{}",
                row.benchmark_name,
                row.model_instance_slug
            );
        }
        let reason = [benchmark_reason, model_reason]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .join("+");
        prediction_run_aliases.push(PredictionRunAlias {
            alias: row.id,
            benchmark_slug: benchmark_slug.to_owned(),
            model_instance_slug: model_instance_slug.to_owned(),
            reason: if reason.is_empty() {
                "identity".to_owned()
            } else {
                reason
            },
        });
    }

    ensure_all_rules_used("benchmark", &benchmark_rules, &used_benchmark_rules)?;
    ensure_all_rules_used("model-instance", &model_rules, &used_model_rules)?;
    let manifest = LegacyUrlAliasManifest {
        schema_version: 2,
        source: LegacyAliasSource {
            legacy_database_sha256: crate::stream::sha256_file(&options.legacy_database)?,
            canonical_database_sha256: crate::stream::sha256_file(&options.canonical_database)?,
            rules_sha256: crate::stream::sha256_file(&options.rules)?,
            description: options.source_description.trim().to_owned(),
        },
        benchmark_aliases,
        prediction_run_aliases,
        benchmark_target_aliases,
    };
    write_manifest_noclobber(&options.output, &manifest)
}

pub(crate) fn read_manifest(path: &Path, expected_sha256: &str) -> Result<LegacyUrlAliasManifest> {
    let compressed = fs::read(path).with_context(|| format!("read {}", path.display()))?;
    if crate::sha256_bytes(&compressed) != expected_sha256 {
        bail!("legacy URL alias artifact SHA-256 disagrees with catalog");
    }
    let decoder = GzDecoder::new(compressed.as_slice());
    let mut decoder = decoder.take(MAX_DECOMPRESSED_ALIAS_BYTES + 1);
    let mut json = Vec::new();
    decoder
        .read_to_end(&mut json)
        .with_context(|| format!("decompress {}", path.display()))?;
    if json.len() as u64 > MAX_DECOMPRESSED_ALIAS_BYTES {
        bail!("legacy URL alias manifest exceeds the decompressed size limit");
    }
    let manifest: LegacyUrlAliasManifest =
        serde_json::from_slice(&json).with_context(|| format!("parse {}", path.display()))?;
    validate_manifest_metadata(&manifest)?;
    Ok(manifest)
}

fn validate_manifest_metadata(manifest: &LegacyUrlAliasManifest) -> Result<()> {
    if manifest.schema_version != 2
        || manifest.source.description.trim().is_empty()
        || !valid_sha256(&manifest.source.legacy_database_sha256)
        || !valid_sha256(&manifest.source.canonical_database_sha256)
        || !valid_sha256(&manifest.source.rules_sha256)
    {
        bail!("legacy URL alias manifest metadata is invalid");
    }
    Ok(())
}

fn validate_rules(
    rules: AliasRules,
) -> Result<(HashMap<String, AliasRule>, HashMap<String, AliasRule>)> {
    if rules.schema_version != 1 {
        bail!(
            "unsupported legacy URL alias rules schema {}",
            rules.schema_version
        );
    }
    Ok((
        collect_rules("benchmark", rules.benchmark_slugs)?,
        collect_rules("model-instance", rules.model_instance_slugs)?,
    ))
}

fn collect_rules(kind: &str, rules: Vec<AliasRule>) -> Result<HashMap<String, AliasRule>> {
    let mut values = HashMap::new();
    for rule in rules {
        if rule.from.trim().is_empty() || rule.to.trim().is_empty() || rule.reason.trim().is_empty()
        {
            bail!("{kind} alias rule fields must not be empty");
        }
        let source = rule.from.clone();
        if values.insert(source.clone(), rule).is_some() {
            bail!("duplicate {kind} alias rule for {source}");
        }
    }
    Ok(values)
}

fn apply_rule<'a>(
    value: &'a str,
    rules: &'a HashMap<String, AliasRule>,
    used: &mut HashSet<String>,
) -> (&'a str, Option<&'a str>) {
    let Some(rule) = rules.get(value) else {
        return (value, None);
    };
    used.insert(value.to_owned());
    (&rule.to, Some(&rule.reason))
}

fn ensure_all_rules_used(
    kind: &str,
    rules: &HashMap<String, AliasRule>,
    used: &HashSet<String>,
) -> Result<()> {
    if let Some(unused) = rules.keys().find(|source| !used.contains(*source)) {
        bail!("{kind} alias rule source is absent from the legacy database: {unused}");
    }
    Ok(())
}

fn open_read_only(path: &Path, label: &str) -> Result<Connection> {
    Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .with_context(|| format!("open {label} database {}", path.display()))
}

fn write_manifest_noclobber(path: &Path, manifest: &LegacyUrlAliasManifest) -> Result<()> {
    let parent = path
        .parent()
        .context("output path must have a parent directory")?;
    fs::create_dir_all(parent).with_context(|| format!("create {}", parent.display()))?;
    let temporary = TempBuilder::new()
        .prefix(".legacy-url-aliases-")
        .suffix(".json.gz.tmp")
        .tempfile_in(parent)?;
    let mut encoder = GzBuilder::new()
        .mtime(0)
        .write(temporary, Compression::default());
    serde_json::to_writer_pretty(&mut encoder, manifest)?;
    encoder.write_all(b"\n")?;
    let temporary = encoder.finish()?;
    temporary
        .persist_noclobber(path)
        .map_err(|error| error.error)
        .with_context(|| format!("persist {} without overwriting", path.display()))?;
    Ok(())
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value.bytes().all(|byte| byte.is_ascii_hexdigit())
        && value == value.to_ascii_lowercase()
}
