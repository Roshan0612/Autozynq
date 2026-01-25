export class OAuthScopeError extends Error {
  code = "OAUTH_SCOPE_ERROR" as const;
  requiredScopes?: string[];
  constructor(message: string, requiredScopes?: string[]) {
    super(message);
    this.name = "OAuthScopeError";
    this.requiredScopes = requiredScopes;
  }
}

export class OAuthExpiredError extends Error {
  code = "OAUTH_EXPIRED_ERROR" as const;
  constructor(message = "OAuth access token expired or invalid") {
    super(message);
    this.name = "OAuthExpiredError";
  }
}

export class IntegrationPermissionError extends Error {
  code = "INTEGRATION_PERMISSION_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "IntegrationPermissionError";
  }
}
