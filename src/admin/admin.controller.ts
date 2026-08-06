import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedRequest } from 'src/auth/authenticated-request';
import { Roles } from 'src/roles/roles.decorator';
import { Role } from 'src/constants/role.enum';
import { AdminService } from './admin.service';
import { AdminDeactivatedDTO, AdminListDTO } from './dto/adminListDTO';
import { AdminCreatedDTO, CreateAdminDTO } from './dto/createAdminDTO';

@ApiTags('admin')
@ApiBearerAuth('access-token')
// Every route here is super-admin only. Declared on the controller so a new
// endpoint is restricted by default rather than needing to remember it.
@Roles(Role.SuperAdmin)
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({
    summary: 'List all administrators',
    description:
      'Every admin and super admin, newest first, including deactivated ones ' +
      '(check `isActive`). No request body and no parameters. Password hashes ' +
      'are never included.',
  })
  @ApiOkResponse({ type: AdminListDTO })
  @Get('get-all-admins')
  @HttpCode(200)
  async getAllAdmins(): Promise<AdminListDTO> {
    return this.adminService.listAdmins();
  }

  @ApiOperation({
    summary: 'Deactivate an administrator',
    description:
      'Blocks the account from signing in and ends every session it has. The ' +
      'row and its role are kept — `orders.user_id` is ON DELETE RESTRICT, so ' +
      'hard-deleting anyone who has ordered would fail and would destroy order ' +
      'history. The id goes in the path; there is no request body. Refuses to ' +
      'target yourself, a non-administrator, or the last active super admin.',
  })
  @ApiParam({
    name: 'id',
    description: 'Id of the administrator to deactivate.',
  })
  @ApiOkResponse({ type: AdminDeactivatedDTO })
  @ApiResponse({
    status: 400,
    description: 'That user is not an administrator.',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller is not a super admin, or is targeting themselves.',
  })
  @ApiResponse({ status: 404, description: 'No such user.' })
  @ApiResponse({
    status: 409,
    description: 'Already deactivated, or this is the last active super admin.',
  })
  @Delete('delete-admin/:id')
  @HttpCode(200)
  async deleteAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminDeactivatedDTO> {
    return this.adminService.deactivateAdmin(request.user.userId, id);
  }

  @ApiOperation({
    summary: 'Create a new administrator',
    description:
      'Creates a fresh administrator account. Buyers are never promoted into ' +
      'administrators — an account is created as one here, or by the ' +
      '`admin:create` CLI script that bootstraps the first super admin. ' +
      '`role` defaults to admin and may also be super_admin; buyer is rejected. ' +
      'The new account signs in at POST /auth/admin/login and has no Google or ' +
      'Facebook sign-in.',
  })
  @ApiCreatedResponse({ type: AdminCreatedDTO })
  @ApiResponse({
    status: 400,
    description:
      'Missing field, password too short, or a non-administrator role.',
  })
  @ApiResponse({ status: 403, description: 'Caller is not a super admin.' })
  @ApiResponse({ status: 409, description: 'Username or email already taken.' })
  @Post('create-admin')
  @HttpCode(201)
  async createAdmin(@Body() body: CreateAdminDTO): Promise<AdminCreatedDTO> {
    return this.adminService.createAdmin(body);
  }
}
