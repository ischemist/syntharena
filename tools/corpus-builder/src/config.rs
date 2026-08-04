use std::{collections::HashSet, fs, path::Path};

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CorpusCatalog {
    pub schema_version: String,
    pub publication_status: String,
    pub coverage: CoverageConfig,
    pub evaluation: EvaluationConfig,
    #[serde(default)]
    pub producer_trust: Option<ProducerTrustConfig>,
    #[serde(default)]
    pub legacy_url_aliases: Option<LegacyUrlAliasConfig>,
    #[serde(default)]
    pub stocks: Vec<StockConfig>,
    #[serde(default)]
    pub benchmarks: Vec<BenchmarkConfig>,
    #[serde(default)]
    pub models: Vec<ModelConfig>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LegacyUrlAliasConfig {
    pub manifest_path: String,
    pub manifest_sha256: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ProducerTrustConfig {
    pub policy_path: String,
    pub policy_sha256: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CoverageConfig {
    pub mode: CoverageMode,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum CoverageMode {
    Explicit,
    CrossProduct,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EvaluationConfig {
    pub action: String,
    pub artifact_schema_version: String,
    pub tiers: Vec<u8>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct StockConfig {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub artifact_path: String,
    pub manifest_path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enrichment: Option<StockEnrichmentConfig>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct StockEnrichmentConfig {
    pub artifact_path: String,
    pub artifact_sha256: String,
    pub manifest_path: String,
    pub manifest_sha256: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct BenchmarkConfig {
    pub name: String,
    pub stock: String,
    pub series: String,
    pub artifact_path: String,
    pub manifest_path: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ModelConfig {
    /// Stable key used by corpus bundle paths and inventory run bindings.
    pub key: String,
    pub algorithm_name: String,
    pub algorithm_slug: String,
    pub family_name: String,
    pub family_slug: String,
    pub instance_slug: String,
    pub version: ModelVersion,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ModelVersion {
    pub major: i64,
    pub minor: i64,
    pub patch: i64,
    #[serde(default)]
    pub prerelease: String,
}

impl CorpusCatalog {
    pub fn empty() -> Self {
        Self {
            schema_version: "1".to_owned(),
            publication_status: "staging".to_owned(),
            coverage: CoverageConfig {
                mode: CoverageMode::Explicit,
            },
            evaluation: EvaluationConfig {
                action: "evaluate:v2".to_owned(),
                artifact_schema_version: "2".to_owned(),
                tiers: vec![0],
            },
            producer_trust: None,
            legacy_url_aliases: None,
            stocks: Vec::new(),
            benchmarks: Vec::new(),
            models: Vec::new(),
        }
    }

    pub fn stock(&self, name: &str) -> Option<&StockConfig> {
        self.stocks.iter().find(|value| value.name == name)
    }

    pub fn benchmark(&self, name: &str) -> Option<&BenchmarkConfig> {
        self.benchmarks.iter().find(|value| value.name == name)
    }

    pub fn model(&self, key: &str) -> Option<&ModelConfig> {
        self.models.iter().find(|value| value.key == key)
    }

    pub fn expected_run_count(&self, actual_runs: usize) -> usize {
        match self.coverage.mode {
            CoverageMode::Explicit => actual_runs,
            CoverageMode::CrossProduct => self.benchmarks.len() * self.models.len(),
        }
    }
}

pub fn load_catalog(path: &Path) -> Result<(CorpusCatalog, String)> {
    let bytes = fs::read(path).with_context(|| format!("read {}", path.display()))?;
    let hash = crate::sha256_bytes(&bytes);
    let catalog: CorpusCatalog =
        serde_json::from_slice(&bytes).with_context(|| format!("parse {}", path.display()))?;
    validate_catalog(&catalog)?;
    Ok((catalog, hash))
}

pub fn validate_catalog(catalog: &CorpusCatalog) -> Result<()> {
    if catalog.schema_version != "1" {
        bail!(
            "unsupported corpus catalog schema {}",
            catalog.schema_version
        );
    }
    if catalog.publication_status != "staging" {
        bail!("corpus catalog publication_status must be staging");
    }
    if catalog.evaluation.action != "evaluate:v2"
        || catalog.evaluation.artifact_schema_version != "2"
        || catalog.evaluation.tiers != [0]
    {
        bail!("corpus catalog is outside the supported Tier-0 schema-v2 capability");
    }
    if let Some(aliases) = &catalog.legacy_url_aliases {
        validate_relative("legacy URL alias manifest_path", &aliases.manifest_path)?;
        if aliases.manifest_sha256.len() != 64
            || !aliases
                .manifest_sha256
                .bytes()
                .all(|byte| byte.is_ascii_hexdigit())
            || aliases.manifest_sha256 != aliases.manifest_sha256.to_ascii_lowercase()
        {
            bail!("legacy URL alias manifest_sha256 is invalid");
        }
    }
    if let Some(trust) = &catalog.producer_trust {
        validate_relative("producer trust policy_path", &trust.policy_path)?;
        validate_sha256("producer trust policy_sha256", &trust.policy_sha256)?;
    }

    let mut stock_names = HashSet::new();
    for stock in &catalog.stocks {
        validate_key("stock name", &stock.name)?;
        validate_relative("stock artifact_path", &stock.artifact_path)?;
        validate_relative("stock manifest_path", &stock.manifest_path)?;
        if let Some(enrichment) = &stock.enrichment {
            validate_relative("stock enrichment artifact_path", &enrichment.artifact_path)?;
            validate_relative("stock enrichment manifest_path", &enrichment.manifest_path)?;
            validate_sha256(
                "stock enrichment artifact_sha256",
                &enrichment.artifact_sha256,
            )?;
            validate_sha256(
                "stock enrichment manifest_sha256",
                &enrichment.manifest_sha256,
            )?;
        }
        if !stock_names.insert(stock.name.as_str()) {
            bail!("duplicate stock {}", stock.name);
        }
    }

    let mut benchmark_names = HashSet::new();
    for benchmark in &catalog.benchmarks {
        validate_key("benchmark name", &benchmark.name)?;
        validate_relative("benchmark artifact_path", &benchmark.artifact_path)?;
        validate_relative("benchmark manifest_path", &benchmark.manifest_path)?;
        if !benchmark_names.insert(benchmark.name.as_str()) {
            bail!("duplicate benchmark {}", benchmark.name);
        }
        if !stock_names.contains(benchmark.stock.as_str()) {
            bail!(
                "benchmark {} references unknown stock {}",
                benchmark.name,
                benchmark.stock
            );
        }
        if !matches!(
            benchmark.series.as_str(),
            "MARKET" | "REFERENCE" | "LEGACY" | "OTHER"
        ) {
            bail!(
                "benchmark {} has invalid series {}",
                benchmark.name,
                benchmark.series
            );
        }
    }

    let mut model_keys = HashSet::new();
    let mut instance_slugs = HashSet::new();
    let mut family_versions = HashSet::new();
    let mut algorithms = std::collections::HashMap::new();
    let mut families = std::collections::HashMap::new();
    for model in &catalog.models {
        for (label, value) in [
            ("model key", &model.key),
            ("algorithm slug", &model.algorithm_slug),
            ("family slug", &model.family_slug),
            ("model instance slug", &model.instance_slug),
        ] {
            validate_key(label, value)?;
        }
        if model.algorithm_name.trim().is_empty() || model.family_name.trim().is_empty() {
            bail!("model {} has an empty algorithm or family name", model.key);
        }
        if model.version.major < 0 || model.version.minor < 0 || model.version.patch < 0 {
            bail!("model {} has a negative version component", model.key);
        }
        if algorithms
            .insert(model.algorithm_slug.as_str(), model.algorithm_name.as_str())
            .is_some_and(|existing| existing != model.algorithm_name)
        {
            bail!("algorithm slug reuse disagrees with its name");
        }
        let family_identity = (model.algorithm_slug.as_str(), model.family_name.as_str());
        if families
            .insert(model.family_slug.as_str(), family_identity)
            .is_some_and(|existing| existing != family_identity)
        {
            bail!("model family slug reuse disagrees with its algorithm or name");
        }
        if !model_keys.insert(model.key.as_str()) {
            bail!("duplicate model key {}", model.key);
        }
        if !instance_slugs.insert(model.instance_slug.as_str()) {
            bail!("duplicate model instance slug {}", model.instance_slug);
        }
        let version_key = (
            model.family_slug.as_str(),
            model.version.major,
            model.version.minor,
            model.version.patch,
            model.version.prerelease.as_str(),
        );
        if !family_versions.insert(version_key) {
            bail!("duplicate model family/version for {}", model.key);
        }
    }
    Ok(())
}

fn validate_sha256(label: &str, value: &str) -> Result<()> {
    if value.len() != 64
        || !value.bytes().all(|byte| byte.is_ascii_hexdigit())
        || value != value.to_ascii_lowercase()
    {
        bail!("{label} is invalid");
    }
    Ok(())
}

pub fn validate_key(label: &str, value: &str) -> Result<()> {
    if value.is_empty()
        || value.starts_with('-')
        || value.ends_with('-')
        || value.starts_with('.')
        || value.ends_with('.')
        || value.contains("..")
        || !value.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_' || byte == b'.'
        })
    {
        bail!("{label} must be a safe key using letters, digits, '-', '_', and '.': {value:?}");
    }
    Ok(())
}

fn validate_relative(label: &str, value: &str) -> Result<()> {
    let path = Path::new(value);
    if path.is_absolute()
        || path.components().any(|component| {
            matches!(
                component,
                std::path::Component::ParentDir | std::path::Component::RootDir
            )
        })
    {
        bail!("{label} must be a confined relative path: {value}");
    }
    Ok(())
}
