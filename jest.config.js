module.exports = {
  preset                : 'ts-jest',
  testEnvironment       : 'node',
  transform             : {
    "^.+\\.ts$": "ts-jest"
  },
  moduleFileExtensions  : [
    "ts",
    "js"
  ],
  testRegex             : "^.+\\.spec\\.[jt]s$",
  testPathIgnorePatterns: [
    "dist/lib"
  ]
};