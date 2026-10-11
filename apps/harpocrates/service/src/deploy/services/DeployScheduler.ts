import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import {
  deployConfig,
  type DeployConfigType,
} from "../../config/configuration";
import { type DeployRun, DeployService } from "./DeployService";

/**
 * Keeps deploy targets current: every DEPLOY_SCHEDULE_SECONDS it renews
 * the targets' certificates that are due, moves each target to the
 * newest renewal of its certificate, and deploys what is pending, retrying
 * failures with a backoff. While the signer is sealed renewals and
 * deployments fail, and the next run tries again. One instance runs it;
 * the CLI and the tests turn it off.
 */
@Injectable()
export class DeployScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(DeployScheduler.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private again = false;

  constructor(
    private readonly deploys: DeployService,
    @Inject(deployConfig.KEY) private readonly config: DeployConfigType,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.scheduleSeconds === 0) return;
    this.timer = setInterval(
      () => void this.kick(),
      this.config.scheduleSeconds * 1000,
    );
    void this.kick();
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  /** A run now, or one straight after the run in progress; off when the schedule is. */
  kick(): Promise<void> {
    if (this.config.scheduleSeconds === 0) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        try {
          await this.run();
        } catch (error: unknown) {
          this.logger.error(`The deploy run failed: ${String(error)}`);
        }
      } while (this.again);
    })().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  /** One pass: renew what is due, follow renewals, deploy what is pending. */
  async run(now = new Date()): Promise<DeployRun> {
    const renewals = await this.deploys.renewDue(now);
    const followed = await this.deploys.follow();
    const deployed = await this.deploys.deployPending(now);
    return { ...renewals, followed, deployed };
  }
}
