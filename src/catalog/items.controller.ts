import {
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpCode,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { ItemListResponseDTO } from './dto/itemListDTO';
import { ItemTags } from 'src/constants/item-status.enum';

const ALLOWED_TAGS = Object.values(ItemTags);

@ApiTags('catalog')
@Controller('api/v1/items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get('get-all-items')
  @HttpCode(200)
  // A catalogue is public and identical for every visitor, so it is worth
  // caching hard — the opposite of the auth responses, which carry credentials.
  // Express already emits an ETag, so repeat loads cost bytes, not queries.
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  @ApiOperation({
    summary: 'List the 20 newest items carrying a tag',
    description:
      'Public — no authentication. Returns the 20 most recently created items ' +
      'with the given tag, newest first, excluding expired and discontinued ' +
      'items. Out-of-stock items are still listed.',
  })
  @ApiQuery({
    name: 'tag',
    enum: ItemTags,
    required: true,
    description: 'Which tag to filter by.',
  })
  @ApiOkResponse({ type: ItemListResponseDTO })
  async getAllItems(@Query('tag') tag: string): Promise<ItemListResponseDTO> {
    if (!tag) {
      throw new BadRequestException('tag is required');
    }
    if (!ALLOWED_TAGS.includes(tag as ItemTags)) {
      throw new BadRequestException(
        `tag must be one of: ${ALLOWED_TAGS.join(', ')}`,
      );
    }

    return { items: await this.itemsService.getAllItems(tag as ItemTags) };
  }
}
