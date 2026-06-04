export interface DeviceTokenSnapshot {
  id: string;
  userId: string;
  token: string;
  platform: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterDeviceTokenProps {
  id: string;
  userId: string;
  token: string;
  platform: string;
}

export class DeviceToken {
  private constructor(private readonly props: DeviceTokenSnapshot) {}

  static register(
    props: RegisterDeviceTokenProps,
    now = new Date(),
  ): DeviceToken {
    return new DeviceToken({
      id: props.id,
      userId: props.userId,
      token: props.token,
      platform: props.platform,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(snapshot: DeviceTokenSnapshot): DeviceToken {
    return new DeviceToken({ ...snapshot });
  }

  get token(): string {
    return this.props.token;
  }

  toSnapshot(): DeviceTokenSnapshot {
    return { ...this.props };
  }
}
