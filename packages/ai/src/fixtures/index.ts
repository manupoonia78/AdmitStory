// The evaluation harness's fixtures (spec §8.11, Appendix J).

export {
  applicantsDir,
  listApplicantSlugs,
  loadApplicant,
  loadApplicants,
  loadExpected,
} from "./load";
export {
  goldenCorpus,
  inventedFacts,
  inventedInSentence,
  numbersIn,
  outputSentences,
  type GoldenCorpus,
  type GoldenMaterial,
  type InventedFact,
  type InventedKind,
} from "./golden";
export { fixtureDossierInput, type FixtureDossier } from "./dossier";
export {
  scriptedAnswer,
  simulateSession,
  simulateSuite,
  type SimulateOptions,
  type SimulatedTurn,
  type SimulationResult,
  type SuiteResult,
} from "./simulate";
export {
  FixtureExpected,
  FixtureProfile,
  GroundTruth,
  GroundTruthFact,
  GroundTruthStory,
  groundTruthText,
  type Fixture,
} from "./types";
