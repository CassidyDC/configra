/**
 * Reject Python dependency operations until an environment manager is explicitly supported.
 *
 * @returns {never} This unsupported operation always throws.
 * @throws {Error} Explains that Python installation is not implemented.
 */
export function installation() {
  throw new Error("Python dependency installation is not supported yet; no environment manager is assumed");
}
