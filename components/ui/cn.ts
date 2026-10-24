/** Joins class names, dropping falsy ones. */
export const cn = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ');
