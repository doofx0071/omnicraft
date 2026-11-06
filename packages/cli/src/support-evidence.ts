// Stable public entry point. Keep consumers importing from this module while the
// support evidence implementation stays grouped by concern under ./support/.
export {
  DOCKER_MODULE_SCENARIOS,
  FRONTEND_RUNTIME_SCENARIOS,
  INTEGRATION_TARGETS,
  LARAVEL_INERTIA_REACT_AUTH_SCENARIOS,
  LARAVEL_LIVEWIRE_AUTH_SCENARIOS,
  LARAVEL_SANCTUM_SPA_AUTH_SCENARIOS,
  MODULE_RUNTIME_SCENARIOS,
  NATIVE_PLATFORM_SCENARIOS,
  NEXTJS_DATABASE_SCENARIOS,
  NODE_RUNTIME_SCENARIOS,
  integrationScenarios,
  type IntegrationTargetId,
  type NodeRuntimeScenario,
} from './support/scenarios.js'
export {
  REACT_VITE_TESTING_FOLLOWUP_COMBINATIONS,
  REACT_VITE_TESTING_FOLLOWUP_SCENARIOS,
  REACT_VITE_TESTING_NONREJECTED_COMBINATIONS,
  REACT_VITE_TESTING_REJECTED_COMBINATIONS,
  reactViteTestingGroupId,
  type SupportedCombination,
} from './support/combinations.js'
export {
  SUPPORTED_CAPABILITIES,
  type SupportMatrixFormat,
  type SupportedCapability,
} from './support/supported-capabilities.js'
export {
  JAVASCRIPT_FRONTEND_GUARD_MESSAGE,
  LARAVEL_INERTIA_REACT_DATABASE_GUARD_MESSAGE,
  LARAVEL_LIVEWIRE_DATABASE_GUARD_MESSAGE,
  NATIVE_LANGUAGE_GUARD_MESSAGE,
  NATIVE_WEB_FLAGS_GUARD_MESSAGE,
  NEXTJS_EXTRAS_GUARD_MESSAGE,
  NEXTJS_SEPARATE_BACKEND_GUARD_MESSAGE,
  REJECTED_MODULE_CAPABILITIES,
  SHADCN_FRONTEND_GUARD_MESSAGE,
  SHADCN_PHP_RUNTIME_GUARD_MESSAGE,
  SHADCN_PYTHON_RUNTIME_GUARD_MESSAGE,
  TESTING_MODULE_FRONTEND_GUARD_MESSAGE,
  TESTING_MODULE_JS_SHADCN_GUARD_MESSAGE,
  type RejectedCombination,
  type RejectedCombinationFlags,
  type RejectedModuleCapability,
  type RejectionGuard,
} from './support/rejected-capabilities.js'
export {
  registeredMatrixRowPrefix,
  registeredRejectedMatrixRowPrefix,
} from './support/renderers.js'
