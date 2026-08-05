type DatabaseEnvironment = {
    DATABASE_URL?: string
    SYNTHARENA_DATABASE_READONLY?: string
}

export function databaseAdapterConfig(environment: DatabaseEnvironment) {
    const url = environment.DATABASE_URL
    if (!url) {
        throw new Error('DATABASE_URL environment variable is not set')
    }

    const readonlyFlag = environment.SYNTHARENA_DATABASE_READONLY
    if (readonlyFlag !== undefined && readonlyFlag !== 'true' && readonlyFlag !== 'false') {
        throw new Error('SYNTHARENA_DATABASE_READONLY must be either true or false')
    }

    const readonly = readonlyFlag === 'true'
    return {
        url,
        readonly,
        fileMustExist: readonly,
    }
}
