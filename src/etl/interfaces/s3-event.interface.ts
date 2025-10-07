export interface S3EventRecord {
  eventSource: 'aws:s3';
  eventName: string;
  s3: {
    bucket: {
      name: string;
    };
    object: {
      key: string;
      size?: number;
    };
  };
}

export interface S3Event {
  Records: S3EventRecord[];
}
