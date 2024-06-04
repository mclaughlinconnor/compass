export type FeatureFlagDefinition = {
  /**
   * Defines the feature flag behavior depending on its stage.
   *
   * - 'development': the feature flag is disabled by default and only shown in settings in Local Development and Dev Packages.
   * - 'preview': the feature flag is disabled by default but shown under the Feature Preview settings.
   * - 'released': the feature flag is always enabled, is not read from disk and cannot be disabled from settings.
   */
  stage: 'development' | 'preview' | 'released';
  description: {
    short: string;
    long?: string;
  };
};

export type FeatureFlags = {
  enableOidc: boolean; // Not capitalized "OIDC" for spawn arg casing.
  newExplainPlan: boolean;
  showInsights: boolean;
  enableRenameCollectionModal: boolean;
  enableNewMultipleConnectionSystem: boolean;
  showGenAIPassSampleDocumentsSetting: boolean;
};

export const featureFlags: Required<{
  [K in keyof FeatureFlags]: FeatureFlagDefinition;
}> = {
  /**
   * Feature flag for enabling OIDC authentication.
   * Epic: COMPASS-5955
   */
  enableOidc: {
    stage: 'released',
    description: {
      short: 'Enable OIDC Authentication',
    },
  },

  newExplainPlan: {
    stage: 'released',
    description: {
      short: 'Access explain plan from query bar',
      long: 'Explain plan is now accessible right from the query bar. To view a query’s execution plan, click “Explain” as you would on an aggregation pipeline.',
    },
  },

  showInsights: {
    stage: 'released',
    description: {
      short: 'Show performance insights',
      long: 'Surface visual signals in the Compass interface to highlight potential performance issues and anti-patterns.',
    },
  },

  /**
   * Feature flag for the rename collection modal.
   */
  enableRenameCollectionModal: {
    stage: 'released',
    description: {
      short: 'Enables renaming a collection',
      long: 'Allows users to rename a collection from the sidebar',
    },
  },

  /**
   * Feature flag for the new multiple connection UI.
   * Epic: COMPASS-6410
   */
  enableNewMultipleConnectionSystem: {
    stage: 'development',
    description: {
      short: 'Enables support for multiple connections.',
      long: 'Allows users to open multiple connections in the same window.',
    },
  },

  /**
   * Feature flag for showing the option to pass sample documents with our query and aggregation generation requests.
   * Enables showing the `enableGenAISampleDocumentPassing` setting in the settings UI so folks can turn it on.
   * Epic: COMPASS-7584
   */
  showGenAIPassSampleDocumentsSetting: {
    stage: 'development',
    description: {
      short: 'Enable showing the sample document gen ai setting.',
      long: 'Allows users to show a setting to enable the passing of sample field values with our query and aggregation generation requests.',
    },
  },
};
