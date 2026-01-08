export const zodErrorsToArray = (zodError) => {
    return zodError.map(err => err.message);
}