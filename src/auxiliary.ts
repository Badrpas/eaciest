/**
 * Modifies array by removing provided element from it
 * @returns Modified array
 */
export function removeElementFromArray (array: Array<any>, element: any) {
  const index = array.indexOf(element);
  if (index > -1) {
    array.splice(index, 1);
  }
  return array;
}

export const logger = {
  info (...args: any[]) {
    console.log(...args);
  },
  warn (...args: any[]) {
    console.warn(...args);
  },
  error (...args: any[]) {
    console.error(...args);
  },
  verbose (...args: any[]) {
    console.log(...args);
  },
};
