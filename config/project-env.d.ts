export const DEFAULT_DATABASE_URL: "file:./dev.db";
export const DEFAULT_POSTGRES_CLI_URL: string;

export function commandRequiresDirectUrl(command?: string[]): boolean;
export function isHostedDeploymentEnvironment(environment?: NodeJS.ProcessEnv): boolean;
export function isPostgresDatabaseUrl(databaseUrl: unknown): boolean;
export function loadProjectEnv(projectRoot?: string): void;
export function resolveDatabaseProvider(
  databaseUrl: string,
): "sqlite" | "postgresql";
export function resolveDatabaseUrl(projectRoot?: string): string;
export function resolvePrismaCliDatabaseUrl(options?: {
  projectRoot?: string;
  provider?: "sqlite" | "postgresql";
  command?: string[];
}): string;
export function validateDatabaseUrl(
  databaseUrl: string,
  variableName?: string,
): string;
