export function getEnvVar(name: string, required = true): string | undefined {
    const value = process.env[name];
    if (!value && required) {
      throw new Error(`${name} not found in environment variables`);
    }
    return value;
  }