type endpoint = () => Promise<void>;

export interface IBaseRouteHandler {
  HandleRequest(handler: endpoint, mockHandler: endpoint): Promise<void>;
  HandleMockRequests(handler: endpoint, mockHandler: endpoint): Promise<void>;
}
