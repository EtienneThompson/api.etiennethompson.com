export const isNullOrWhiteSpace = (val: string): boolean => {
  if (val === null || val === undefined) {
    return true;
  }

  if (val.replace(/\s/, "") === "") {
    return true;
  }

  return false;
};

export const capitalize = (val: string): string => {
  if (isNullOrWhiteSpace(val)) {
    return val;
  }

  if (val.length === 1) {
    return val.toUpperCase();
  }

  return val.charAt(0).toUpperCase() + val.substring(1);
};
