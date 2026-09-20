import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  OVERRIDE_BLOCK_STORE,
  OverrideBlockStore,
} from "../../store/overrideBlockStore";
import { CreateOverrideBlockDto } from "../dto/CreateOverrideBlockDto";
import { ListOverrideBlocksQueryDto } from "../dto/ListOverrideBlocksQueryDto";
import { OverrideBlockResponseDto } from "../dto/OverrideBlockResponseDto";
import { UpdateOverrideBlockStatusDto } from "../dto/UpdateOverrideBlockStatusDto";

/**
 * CRUD for the internal "Overrides" calendar — independent blocks of time
 * that override the computed availability status for everything they
 * cover, regardless of what's synced underneath. See AvailabilityService
 * for how these combine with synced meetings and per-meeting overrides.
 */
@ApiBearerAuth()
@ApiTags("overrides")
@Controller("overrides")
export class OverridesController {
  constructor(
    @Inject(OVERRIDE_BLOCK_STORE) private readonly store: OverrideBlockStore,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: OverrideBlockResponseDto })
  create(
    @Body() body: CreateOverrideBlockDto,
  ): Promise<OverrideBlockResponseDto> {
    if (
      !(new Date(body.startTime).getTime() < new Date(body.endTime).getTime())
    ) {
      throw new BadRequestException("startTime must be before endTime");
    }
    return this.store.create({ ...body, label: body.label ?? null });
  }

  @Get()
  @ApiOkResponse({ type: OverrideBlockResponseDto, isArray: true })
  list(
    @Query() query: ListOverrideBlocksQueryDto,
  ): Promise<OverrideBlockResponseDto[]> {
    return this.store.listOverlapping(query.start, query.end);
  }

  @Put(":id")
  @ApiOkResponse({ type: OverrideBlockResponseDto })
  @ApiNotFoundResponse({ description: "No override block with that id" })
  async updateStatus(
    @Param("id") id: string,
    @Body() body: UpdateOverrideBlockStatusDto,
  ): Promise<OverrideBlockResponseDto> {
    const updated = await this.store.updateStatus(id, body.status);
    if (!updated) {
      throw new NotFoundException(`No override block "${id}"`);
    }
    return updated;
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiNoContentResponse()
  async remove(@Param("id") id: string): Promise<void> {
    await this.store.delete(id);
  }
}
