import { SESEmailParameters } from "../types/aws";
import { SupportEmailBody } from "../types/etiennethompson";
import { ErrorStatusCode, ResponseHelper, SuccessfulStatusCode } from "../utils/response";
import BaseRouteHandler from "./BaseRouteHandler";

class EtienneThompsonHandler extends BaseRouteHandler {
  private responseHelper: ResponseHelper;
  private aws: any;
  constructor(responseHelper: ResponseHelper, aws: any) {
    super(responseHelper.req, responseHelper.next);
    this.responseHelper = responseHelper;
    this.aws = aws;
  }

  public async SendSupportEmail(): Promise<void> {
    var supportRequest = this.responseHelper.req.body as SupportEmailBody;

    const emailMessage = `
    New support request for ${supportRequest.app}

    First Name: ${supportRequest.firstName}
    Last Name: ${supportRequest.lastName}
    Email: ${supportRequest.email}
    Subject: ${supportRequest.subject}

    Message:
    ${supportRequest.message}
    `;

    var emailParams: SESEmailParameters = {
      Destination: {
        ToAddresses: ["et@etiennethompson.com"],
      },
      Message: {
        Body: {
          Text: {
            Charset: "UTF-8",
            Data: emailMessage,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: `New support request: ${supportRequest.subject}`,
        },
      },
      Source: "noreply@etiennethompson.com",
    };

    var ses = new this.aws.SES({ apiVersion: "2010-12-01" });
    await ses.sendEmail(emailParams, (err: any, data: any) => {
      if (err) {
        console.log(err);
        return this.responseHelper.ErrorResponse(ErrorStatusCode.BadRequest, "Failed to send the email.");
      }
    });

    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok);
  }
}

export default EtienneThompsonHandler;
