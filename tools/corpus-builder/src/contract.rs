use std::{collections::BTreeMap, fs, path::Path};

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::{
    config::{CorpusCatalog, CoverageMode},
    stream::sha256_file,
};

pub const RETROCAST_VERSION: &str = "0.8.3";
pub const RETROCAST_RELEASE_TAG: &str = "v0.8.3";
pub const RETROCAST_RELEASE_COMMIT: &str = "33ec506f82d961fad86ddc5260724c45bfcd50e9";
pub const ARTIFACT_SCHEMA_VERSION: &str = "2";

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Inventory {
    pub schema_version: String,
    pub publication_status: String,
    pub matrix: Matrix,
    pub evaluation_parameters: EvaluationParameters,
    pub runs: Vec<InventoryRun>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Matrix {
    pub benchmarks: usize,
    pub models: usize,
    pub expected_runs: usize,
    pub completed: usize,
    pub failed: usize,
    pub unavailable: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct EvaluationParameters {
    pub action: String,
    pub schema_version: String,
    pub tiers: Vec<u8>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct InventoryRun {
    pub run_id: String,
    pub model: String,
    pub adapter: String,
    pub benchmark: String,
    pub stock: String,
    pub bundle_path: String,
    pub raw_path: String,
    pub raw_sha256: String,
    pub execution_stats_path: String,
    pub execution_stats_sha256: String,
    /// Optional price override for this planner execution. When absent, the
    /// model instance default from the corpus catalog applies.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hourly_cost_usd: Option<f64>,
    pub status: String,
    pub strict_manifest_verified: bool,
    pub manifest_sha256: String,
    #[serde(default)]
    pub producer_sha256: String,
    pub targets: usize,
    pub expected_targets: usize,
    pub candidates: usize,
    pub routes: usize,
    pub failures: usize,
    pub tier_0_validity_rate: MetricSummary,
    pub solv_0_rate: MetricSummary,
    pub solv_0_rate_key: String,
    pub producer: Producer,
    pub runtime: EvaluationRun,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Producer {
    pub retrocast_version: String,
    pub release_tag: String,
    pub release_commit: String,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ProducerEvidence {
    pub engine: String,
    pub executable_path: String,
    pub executable_sha256: String,
    pub release_asset: String,
    pub release_asset_sha256: String,
    pub release_commit: String,
    pub release_tag: String,
    pub release_url: String,
    pub retrocast_version: String,
}

impl ProducerEvidence {
    pub fn producer(&self) -> Producer {
        Producer {
            retrocast_version: self.retrocast_version.clone(),
            release_tag: self.release_tag.clone(),
            release_commit: self.release_commit.clone(),
        }
    }

    pub fn validate(&self) -> Result<()> {
        if self.engine.trim().is_empty()
            || self.executable_path.trim().is_empty()
            || self.release_asset.trim().is_empty()
            || self.release_url.trim().is_empty()
        {
            bail!("producer evidence contains an empty required field");
        }
        for (label, hash) in [
            ("producer executable", &self.executable_sha256),
            ("producer release asset", &self.release_asset_sha256),
        ] {
            validate_sha256(label, hash)?;
        }
        if self.retrocast_version != RETROCAST_VERSION
            || self.release_tag != RETROCAST_RELEASE_TAG
            || self.release_commit != RETROCAST_RELEASE_COMMIT
        {
            bail!("producer.json is not the approved RetroCast v0.8.3 release");
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct FileInfo {
    pub path: String,
    #[serde(alias = "file_hash")]
    pub sha256: String,
    #[serde(flatten)]
    pub extensions: Map<String, Value>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Manifest {
    pub schema_version: String,
    pub retrocast_version: String,
    pub created_at: String,
    pub action: String,
    #[serde(default)]
    pub parameters: Map<String, Value>,
    #[serde(default)]
    pub directives: Map<String, Value>,
    #[serde(default)]
    pub source_files: Vec<FileInfo>,
    #[serde(default)]
    pub output_files: Vec<FileInfo>,
    #[serde(default)]
    pub statistics: Map<String, Value>,
    #[serde(default)]
    pub summary: Map<String, Value>,
    #[serde(flatten)]
    pub extensions: Map<String, Value>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Reliability {
    pub code: String,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct MetricSummary {
    pub value: f64,
    pub count: usize,
    #[serde(default)]
    pub ci_low: Option<f64>,
    #[serde(default)]
    pub ci_high: Option<f64>,
    #[serde(default)]
    pub reliability: Option<Reliability>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RuntimeSummary {
    #[serde(default)]
    pub total_wall_time: Option<f64>,
    #[serde(default)]
    pub mean_wall_time: Option<f64>,
    #[serde(default)]
    pub total_cpu_time: Option<f64>,
    #[serde(default)]
    pub mean_cpu_time: Option<f64>,
    pub timed_target_count: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Analysis {
    pub schema_version: String,
    pub metrics: BTreeMap<String, MetricSummary>,
    #[serde(default)]
    pub by_stratum: BTreeMap<String, BTreeMap<String, MetricSummary>>,
    pub bootstrap_resamples: usize,
    pub runtime: RuntimeSummary,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct EvaluationRun {
    pub engine: String,
    pub workers: usize,
    pub targets: usize,
    pub candidates: usize,
    pub ingest_seconds: f64,
    pub score_seconds: f64,
    pub analyze_seconds: f64,
    pub total_seconds: f64,
    pub targets_per_second: f64,
    pub candidates_per_second: f64,
}

impl Inventory {
    pub fn empty() -> Self {
        Self {
            schema_version: "2".to_owned(),
            publication_status: "staging".to_owned(),
            matrix: Matrix {
                benchmarks: 0,
                models: 0,
                expected_runs: 0,
                completed: 0,
                failed: 0,
                unavailable: 0,
            },
            evaluation_parameters: EvaluationParameters {
                action: "evaluate:v2".to_owned(),
                schema_version: "2".to_owned(),
                tiers: vec![0],
            },
            runs: Vec::new(),
        }
    }

    pub fn refresh_matrix(&mut self, catalog: &CorpusCatalog) {
        self.matrix.benchmarks = catalog.benchmarks.len();
        self.matrix.models = catalog.models.len();
        self.matrix.expected_runs = catalog.expected_run_count(self.runs.len());
        self.matrix.completed = self.runs.len();
        self.matrix.failed = 0;
        self.matrix.unavailable = 0;
    }
}

pub fn load_inventory(
    path: &Path,
    limit: Option<usize>,
    catalog: &CorpusCatalog,
) -> Result<(Inventory, String)> {
    let bytes = fs::read(path).with_context(|| format!("read {}", path.display()))?;
    let inventory_sha256 = crate::sha256_bytes(&bytes);
    let inventory: Inventory =
        serde_json::from_slice(&bytes).with_context(|| format!("parse {}", path.display()))?;
    validate_inventory(&inventory, limit, catalog)?;
    Ok((inventory, inventory_sha256))
}

pub fn validate_inventory(
    inventory: &Inventory,
    limit: Option<usize>,
    catalog: &CorpusCatalog,
) -> Result<()> {
    validate_limit(limit, inventory.runs.len())?;
    if inventory.schema_version != "2" {
        bail!("unsupported inventory schema {}", inventory.schema_version);
    }
    let accepted_status = match limit {
        Some(_) => ["staging", "local-provisional"].as_slice(),
        None => ["staging"].as_slice(),
    };
    if !accepted_status.contains(&inventory.publication_status.as_str()) {
        bail!(
            "inventory publication_status must be one of {:?}, got {:?}",
            accepted_status,
            inventory.publication_status
        );
    }
    if inventory.evaluation_parameters.action != catalog.evaluation.action
        || inventory.evaluation_parameters.schema_version
            != catalog.evaluation.artifact_schema_version
        || inventory.evaluation_parameters.tiers != catalog.evaluation.tiers
    {
        bail!("inventory evaluation parameters are not the exact Tier-0 schema-v2 contract");
    }
    let expected_runs = catalog.expected_run_count(inventory.runs.len());
    if inventory.matrix.completed != inventory.runs.len()
        || inventory.matrix.failed != 0
        || inventory.matrix.unavailable != 0
        || (catalog.coverage.mode == CoverageMode::CrossProduct
            && inventory.runs.len() != expected_runs)
    {
        bail!("inventory run status does not match the corpus catalog coverage policy");
    }
    let mut keys = std::collections::HashSet::new();
    let mut canonical_run_keys = std::collections::HashSet::new();
    for run in &inventory.runs {
        let expected_id = format!("{}/{}", run.benchmark, run.model);
        if run.run_id != expected_id || !keys.insert(run.run_id.clone()) {
            bail!("invalid or duplicate inventory run_id {}", run.run_id);
        }
        let expected_bundle_path = format!("bundles/{}/{}", run.benchmark, run.model);
        if run.bundle_path != expected_bundle_path {
            bail!(
                "inventory bundle_path must be the confined canonical path for {}",
                run.run_id
            );
        }
        if run.status != "completed" || !run.strict_manifest_verified {
            bail!("inventory contains an incomplete or unverified run");
        }
        let benchmark = catalog.benchmark(&run.benchmark).with_context(|| {
            format!(
                "inventory run references unknown benchmark {}",
                run.benchmark
            )
        })?;
        let model = catalog
            .model(&run.model)
            .with_context(|| format!("inventory run references unknown model {}", run.model))?;
        let canonical_run_key = format!("{}/{}", benchmark.name, model.instance_slug);
        if !canonical_run_keys.insert(canonical_run_key.clone()) {
            bail!("duplicate canonical prediction-run identity {canonical_run_key}");
        }
        if catalog.stock(&run.stock).is_none() || benchmark.stock != run.stock {
            bail!("inventory stock binding disagrees for {}", run.run_id);
        }
        if run.producer.retrocast_version != RETROCAST_VERSION
            || run.producer.release_tag != RETROCAST_RELEASE_TAG
            || run.producer.release_commit != RETROCAST_RELEASE_COMMIT
        {
            bail!("inventory run is not pinned to the approved RetroCast v0.8.3 release");
        }
        if run.targets != run.expected_targets
            || run.routes + run.failures != run.candidates
            || run.runtime.targets != run.targets
            || run.runtime.candidates != run.candidates
            || run.runtime.engine != "rust"
            || run.solv_0_rate_key != format!("solv_0[{}]_rate", run.stock)
        {
            bail!("inventory counts or metric key disagree for {}", run.run_id);
        }
        if run
            .hourly_cost_usd
            .is_some_and(|value| !value.is_finite() || value < 0.0)
        {
            bail!(
                "inventory hourly_cost_usd for {} must be finite and non-negative",
                run.run_id
            );
        }
        for (label, hash) in [
            ("manifest", &run.manifest_sha256),
            ("producer", &run.producer_sha256),
            ("raw", &run.raw_sha256),
            ("execution stats", &run.execution_stats_sha256),
        ] {
            validate_sha256(&format!("inventory {label} for {}", run.run_id), hash)?;
        }
    }
    if catalog.coverage.mode == CoverageMode::CrossProduct {
        for benchmark in &catalog.benchmarks {
            for model in &catalog.models {
                let key = format!("{}/{}", benchmark.name, model.key);
                if !keys.contains(&key) {
                    bail!("cross-product corpus is missing {key}");
                }
            }
        }
    }
    Ok(())
}

pub fn load_producer(
    path: &Path,
    expected_sha256: Option<&str>,
) -> Result<(ProducerEvidence, String)> {
    let bytes = fs::read(path).with_context(|| format!("read {}", path.display()))?;
    let sha256 = crate::sha256_bytes(&bytes);
    if expected_sha256.is_some_and(|expected| sha256 != expected.to_ascii_lowercase()) {
        bail!("producer.json SHA-256 mismatch for {}", path.display());
    }
    let evidence: ProducerEvidence = serde_json::from_slice(&bytes)?;
    evidence.validate()?;
    Ok((evidence, sha256))
}

fn validate_sha256(label: &str, hash: &str) -> Result<()> {
    if hash.len() != 64
        || !hash.bytes().all(|byte| byte.is_ascii_hexdigit())
        || hash != hash.to_ascii_lowercase()
    {
        bail!("{label} SHA-256 is invalid");
    }
    Ok(())
}

fn validate_limit(limit: Option<usize>, run_count: usize) -> Result<()> {
    if matches!(limit, Some(0)) || limit.is_some_and(|value| value > run_count) {
        bail!("--limit must be between 1 and {run_count}");
    }
    Ok(())
}

pub fn load_manifest(path: &Path, expected_sha256: &str) -> Result<(Manifest, String)> {
    let bytes = fs::read(path).with_context(|| format!("read {}", path.display()))?;
    let actual = crate::sha256_bytes(&bytes);
    if actual != expected_sha256.to_ascii_lowercase() {
        bail!("manifest SHA-256 mismatch for {}", path.display());
    }
    let manifest: Manifest = serde_json::from_slice(&bytes)?;
    if manifest.schema_version != ARTIFACT_SCHEMA_VERSION
        || manifest.retrocast_version != RETROCAST_VERSION
        || manifest.action != "evaluate:v2"
    {
        bail!("manifest is not the exact RetroCast v0.8.3 schema-v2 evaluate contract");
    }
    Ok((manifest, String::from_utf8(bytes)?))
}

pub fn tracked_output<'a>(manifest: &'a Manifest, file_name: &str) -> Result<&'a FileInfo> {
    let matches: Vec<_> = manifest
        .output_files
        .iter()
        .filter(|file| {
            Path::new(&file.path)
                .file_name()
                .is_some_and(|name| name == file_name)
        })
        .collect();
    if matches.len() != 1 {
        bail!("manifest must track exactly one {file_name}");
    }
    Ok(matches[0])
}

pub fn verify_unparsed_outputs(
    bundle_root: &Path,
    manifest: &Manifest,
    parsed: &[&str],
) -> Result<()> {
    for output in &manifest.output_files {
        if parsed.iter().any(|name| {
            Path::new(&output.path)
                .file_name()
                .is_some_and(|item| item == *name)
        }) {
            continue;
        }
        let path = crate::stream::resolve_confined_regular(bundle_root, &output.path)?;
        let actual = sha256_file(&path)?;
        if actual != output.sha256.to_ascii_lowercase() {
            bail!("output SHA-256 mismatch for {}", path.display());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate_limit;

    #[test]
    fn subset_limit_must_select_a_real_nonempty_prefix() {
        assert!(validate_limit(Some(0), 84).is_err());
        assert!(validate_limit(Some(85), 84).is_err());
        assert!(validate_limit(Some(1), 84).is_ok());
        assert!(validate_limit(Some(84), 84).is_ok());
        assert!(validate_limit(None, 84).is_ok());
    }
}
