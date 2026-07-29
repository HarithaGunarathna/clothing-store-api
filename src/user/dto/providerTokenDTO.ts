/**
 * Body for the client-side sign-in endpoints. Google's SDK yields an OIDC ID
 * token; Facebook's yields an access token — hence the two fields.
 */
export class ProviderTokenDTO {
  readonly idToken?: string;
  readonly accessToken?: string;
}
