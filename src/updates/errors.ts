export type UpdateErrorCode =
  | 'network'
  | 'invalid'
  | 'signature'
  | 'channel'
  | 'app'
  | 'platform'
  | 'package'
  | 'version'
  | 'download'
  | 'hash'
  | 'storage'
  | 'install'
  | 'unsupported';

/** An update failure with a message that can be shown to the user. */
export class UpdateError extends Error {
  readonly code: UpdateErrorCode;

  constructor(code: UpdateErrorCode, message: string) {
    super(message);
    this.name = 'UpdateError';
    this.code = code;
  }
}
