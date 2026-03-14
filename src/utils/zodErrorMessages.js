export const zodErrorsToArray = (zodError) => {
    console.log(zodError)
    return zodError.map(err => err.message);
}