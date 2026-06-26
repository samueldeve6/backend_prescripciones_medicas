import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Obtener los roles requeridos desde el decorador @Roles
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    // 2. Obtener el usuario del request (puesto ahí por el JwtAuthGuard)
    const { user } = context.switchToHttp().getRequest();
    
    // 3. Validar si el rol del usuario está en la lista permitida
    return requiredRoles.some((role) => user.role?.includes(role));
  }
}