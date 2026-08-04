use std::collections::BTreeMap;

use anyhow::{Result, bail};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

use crate::identity::hash_json;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Reaction {
    pub reactants: Vec<Molecule>,
    #[serde(default)]
    pub mapped_reaction_smiles: Option<String>,
    #[serde(default)]
    pub template: Option<String>,
    #[serde(default)]
    pub reagents: Option<Vec<String>>,
    #[serde(default)]
    pub solvents: Option<Vec<String>>,
    #[serde(default)]
    pub annotations: Map<String, Value>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Molecule {
    pub smiles: String,
    pub inchikey: String,
    #[serde(default)]
    pub product_of: Option<Box<Reaction>>,
    #[serde(default)]
    pub annotations: Map<String, Value>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Route {
    pub target: Molecule,
    #[serde(default)]
    pub annotations: Map<String, Value>,
    #[serde(default = "schema_v2")]
    pub schema_version: String,
}

fn schema_v2() -> String {
    "2".to_owned()
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct FailureRecord {
    pub code: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_smiles: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_inchikey: Option<String>,
    #[serde(default)]
    pub context: Map<String, Value>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Candidate {
    pub rank: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub route: Option<Route>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failure: Option<FailureRecord>,
}

impl Candidate {
    pub fn validate(&self) -> Result<()> {
        if self.rank == 0 {
            bail!("candidate rank must be at least 1");
        }
        if self.route.is_some() == self.failure.is_some() {
            bail!("candidate must contain exactly one of route or failure");
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct CheckResult {
    pub code: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default)]
    pub details: Map<String, Value>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TierResult {
    pub status: String,
    #[serde(default)]
    pub checks: Vec<CheckResult>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct RouteValidity {
    #[serde(default)]
    pub tiers: BTreeMap<u8, TierResult>,
    #[serde(default)]
    pub reactions: Vec<Value>,
    #[serde(flatten)]
    pub extensions: Map<String, Value>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ConstraintResult {
    pub status: String,
    #[serde(default)]
    pub checks: Vec<CheckResult>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ScoredCandidate {
    pub rank: usize,
    #[serde(default)]
    pub route: Option<Route>,
    #[serde(default)]
    pub failure: Option<FailureRecord>,
    pub validity: RouteValidity,
    pub constraints: ConstraintResult,
    #[serde(default)]
    pub matches_acceptable: bool,
    #[serde(default)]
    pub matched_acceptable_index: Option<usize>,
}

impl ScoredCandidate {
    pub fn validate(&self) -> Result<()> {
        Candidate {
            rank: self.rank,
            route: self.route.clone(),
            failure: self.failure.clone(),
        }
        .validate()?;
        if self.matches_acceptable != self.matched_acceptable_index.is_some() {
            bail!(
                "matched acceptable index must be present exactly when matches_acceptable is true"
            );
        }
        validate_status(&self.constraints.status)?;
        for tier in self.validity.tiers.values() {
            validate_status(&tier.status)?;
        }
        Ok(())
    }

    pub fn candidate_projection(&self) -> Candidate {
        Candidate {
            rank: self.rank,
            route: self.route.clone(),
            failure: self.failure.clone(),
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
pub struct TargetResult {
    pub target: BenchmarkTarget,
    pub effective_constraints: Vec<Value>,
    #[serde(default)]
    pub candidates: Vec<ScoredCandidate>,
    #[serde(default)]
    pub wall_time: Option<f64>,
    #[serde(default)]
    pub cpu_time: Option<f64>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct BenchmarkTarget {
    pub id: String,
    pub smiles: String,
    pub inchikey: String,
    #[serde(default)]
    pub acceptable_routes: Vec<Route>,
    #[serde(default)]
    pub annotations: Map<String, Value>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct BenchmarkDefinition {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub stock_name: Option<String>,
    pub targets: BTreeMap<String, BenchmarkTarget>,
    #[serde(default = "schema_v2")]
    pub schema_version: String,
    #[serde(default, rename = "annotations")]
    pub _annotations: Map<String, Value>,
    #[serde(default)]
    pub default_constraints: Vec<Value>,
    #[serde(default)]
    pub constraints: BTreeMap<String, Vec<Value>>,
    #[serde(flatten)]
    pub extensions: Map<String, Value>,
}

#[derive(Clone, Debug)]
pub struct EvaluationHeader {
    pub task_name: String,
    pub task_json: String,
    pub tiers: Vec<u8>,
    pub metric_label: String,
    pub acceptable_match_level: String,
    pub acceptable_route_match: String,
    pub task_default_constraints: Vec<Value>,
    pub task_constraints: BTreeMap<String, Vec<Value>>,
    pub task_metric_label: Option<String>,
}

pub fn validate_status(status: &str) -> Result<()> {
    if !matches!(status, "pass" | "fail" | "not_evaluated") {
        bail!("unknown RetroCast status {status:?}");
    }
    Ok(())
}

pub fn database_status(status: &str) -> Result<&'static str> {
    validate_status(status)?;
    Ok(match status {
        "pass" => "PASS",
        "fail" => "FAIL",
        "not_evaluated" => "NOT_EVALUATED",
        _ => unreachable!(),
    })
}

pub fn normalized_route_value(route: &Route) -> Value {
    fn molecule_value(molecule: &Molecule) -> Value {
        let mut value = Map::new();
        value.insert("smiles".to_owned(), json!(molecule.smiles));
        value.insert("inchikey".to_owned(), json!(molecule.inchikey));
        if let Some(reaction) = molecule.product_of.as_deref() {
            value.insert("product_of".to_owned(), reaction_value(reaction));
        }
        value.insert(
            "annotations".to_owned(),
            Value::Object(molecule.annotations.clone()),
        );
        Value::Object(value)
    }
    fn reaction_value(reaction: &Reaction) -> Value {
        json!({
            "reactants": reaction.reactants.iter().map(molecule_value).collect::<Vec<_>>(),
            "mapped_reaction_smiles": reaction.mapped_reaction_smiles,
            "template": reaction.template,
            "reagents": reaction.reagents,
            "solvents": reaction.solvents,
            "annotations": reaction.annotations,
        })
    }
    json!({
        "target": molecule_value(&route.target),
        "annotations": route.annotations,
        "schema_version": "2",
    })
}

pub fn route_content_hash(route: &Route) -> String {
    hash_json(&normalized_route_value(route))
}

pub fn route_signature(route: &Route) -> String {
    route_signature_at_depth(route, None)
}

pub fn route_signature_at_depth(route: &Route, depth: Option<usize>) -> String {
    molecule_subtree_signature(&route.target, depth)
}

fn molecule_subtree_signature(molecule: &Molecule, depth: Option<usize>) -> String {
    hash_json(&molecule_subtree_key(molecule, depth))
}

fn molecule_subtree_key(molecule: &Molecule, depth: Option<usize>) -> Value {
    let Some(reaction) = molecule.product_of.as_deref() else {
        return json!(["mol", molecule.inchikey]);
    };
    if depth == Some(0) {
        return json!(["mol", molecule.inchikey]);
    }
    let next_depth = depth.map(|value| value - 1);
    let mut child_signatures: Vec<_> = reaction
        .reactants
        .iter()
        .map(|reactant| molecule_subtree_signature(reactant, next_depth))
        .collect();
    child_signatures.sort();
    json!([
        "mol",
        molecule.inchikey,
        reaction_key(reaction, &molecule.inchikey),
        child_signatures
    ])
}

pub fn effective_constraints(
    default_constraints: &[Value],
    target_constraints: &BTreeMap<String, Vec<Value>>,
    target_id: &str,
) -> Result<Vec<Value>> {
    let mut by_kind = BTreeMap::new();
    for constraint in default_constraints
        .iter()
        .chain(target_constraints.get(target_id).into_iter().flatten())
    {
        let kind = constraint
            .as_object()
            .and_then(|value| value.get("kind"))
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow::anyhow!("constraint must be an object with a string kind"))?;
        by_kind.insert(kind.to_owned(), constraint.clone());
    }
    Ok(by_kind.into_values().collect())
}

pub fn validate_stock_termination_constraint(constraints: &[Value], stock: &str) -> Result<()> {
    if constraints
        != [json!({
            "kind": "retrocast.stock_termination",
            "stock": stock,
        })]
    {
        bail!(
            "effective constraints must contain exactly the {stock} stock termination constraint"
        );
    }
    Ok(())
}

fn reaction_key(reaction: &Reaction, product_inchikey: &str) -> Value {
    let mut reactants: Vec<_> = reaction
        .reactants
        .iter()
        .map(|reactant| reactant.inchikey.as_str())
        .collect();
    reactants.sort();
    json!(["rxn", product_inchikey, reactants])
}

pub fn route_depth(molecule: &Molecule) -> usize {
    molecule.product_of.as_deref().map_or(0, |reaction| {
        1 + reaction
            .reactants
            .iter()
            .map(route_depth)
            .max()
            .unwrap_or(0)
    })
}

pub fn route_is_convergent(molecule: &Molecule) -> bool {
    let Some(reaction) = molecule.product_of.as_deref() else {
        return false;
    };
    reaction
        .reactants
        .iter()
        .filter(|reactant| reactant.product_of.is_some())
        .count()
        >= 2
        || reaction.reactants.iter().any(route_is_convergent)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_identity_matches_daedalus_projection_fixture() {
        let route: Route = serde_json::from_value(json!({
            "target": {
                "smiles": "CCO", "inchikey": "ROOT",
                "product_of": {"reactants": [
                    {"smiles": "C", "inchikey": "LEAF-B", "annotations": {}},
                    {"smiles": "O", "inchikey": "LEAF-A", "annotations": {}}
                ], "mapped_reaction_smiles": null, "annotations": {}},
                "annotations": {}
            },
            "annotations": {}, "schema_version": "2"
        }))
        .unwrap();
        assert_eq!(route_depth(&route.target), 1);
        assert!(!route_is_convergent(&route.target));
        assert_eq!(
            route_signature(&route),
            "6aea123b4b2c2a6bd52abf67431950d48ead06937970b1120dbdc46fc8f7719b"
        );
    }
}
