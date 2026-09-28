export const emailValidationRules = (required: boolean = false) => {
  return {
    required: required,
    pattern:
      /^\s*([\w{L}\d\s]+?)\s*<([\w.!#$%&’*+/=?^_`{|}~-]+@[\w-]+(?:\.[\w-]+)+)>|([\w.!#$%&’*+/=?^_`{|}~-]+@[\w-]+(?:\.[\w-]+)+)\s*$/,
  };
};
