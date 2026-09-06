declare module 'node:test' {
  export const describe: any;
  export const it: any;
  export const before: any;
  export const after: any;
  export const beforeEach: any;
  export const afterEach: any;
}

declare module 'node:assert/strict' {
  const assert: any;
  export default assert;
}
