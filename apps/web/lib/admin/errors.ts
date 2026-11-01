/** A refusal the admin can act on, in its own words (e.g. "3 fields still need a decision"). */
export class AdminActionError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = "AdminActionError";
  }
}
