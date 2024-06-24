import { throwIfAborted } from '@mongodb-js/compass-utils';
import type { AtlasAuthService } from './atlas-auth-service';
import type { AtlasServiceConfig } from './util';
import {
  getAtlasConfig,
  throwIfNetworkTrafficDisabled,
  throwIfNotOk,
} from './util';
import type { Logger } from '@mongodb-js/compass-logging';
import type { PreferencesAccess } from 'compass-preferences-model';

export type AtlasServiceOptions = {
  defaultHeaders?: Record<string, string>;
};

export class AtlasService {
  private config: AtlasServiceConfig;
  constructor(
    private readonly authService: AtlasAuthService,
    private readonly preferences: PreferencesAccess,
    private readonly logger: Logger,
    private readonly options?: AtlasServiceOptions
  ) {
    this.config = getAtlasConfig(preferences);
  }
  adminApiEndpoint(path?: string, requestId?: string): string {
    const uri = encodeURI(
      `${this.config.atlasApiBaseUrl}${path ? `/${path}` : ''}`
    );
    const query = requestId
      ? `?request_id=${encodeURIComponent(requestId)}`
      : '';
    return `${uri}${query}`;
  }
  cloudEndpoint(path?: string): string {
    return encodeURI(`${this.config.cloudBaseUrl}${path ? `/${path}` : ''}`);
  }
  driverProxyEndpoint(path?: string): string {
    return encodeURI(`${this.config.wsBaseUrl}${path ? `/${path}` : ''}`);
  }
  async fetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
    throwIfNetworkTrafficDisabled(this.preferences);
    throwIfAborted(init?.signal as AbortSignal);
    this.logger.log.info(
      this.logger.mongoLogId(1_001_000_297),
      'AtlasService',
      'Making a fetch',
      {
        url,
      }
    );
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          ...this.options?.defaultHeaders,
          ...init?.headers,
        },
      });
      this.logger.log.info(
        this.logger.mongoLogId(1_001_000_309),
        'AtlasService',
        'Received API response',
        {
          url,
          status: res.status,
          statusText: res.statusText,
        }
      );
      await throwIfNotOk(res);
      return res;
    } catch (err) {
      this.logger.log.info(
        this.logger.mongoLogId(1_001_000_298),
        'AtlasService',
        'Fetch errored',
        {
          url,
          err,
        }
      );
      throw err;
    }
  }
  async authenticatedFetch(
    url: RequestInfo,
    init?: RequestInit
  ): Promise<Response> {
    const authHeaders = await this.authService.getAuthHeaders();
    return this.fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        ...authHeaders,
      },
    });
  }
}
