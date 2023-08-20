interface SESEmailDestination {
  ToAddresses: string[];
}

interface SESMessageContent {
  Charset: string;
  Data: string;
}

interface SESEmailBody {
  Text: SESMessageContent;
}

interface SESEmailMessage {
  Body: SESEmailBody;
  Subject: SESMessageContent;
}

export interface SESEmailParameters {
  Destination: SESEmailDestination;
  Message: SESEmailMessage;
  Source: string;
}
