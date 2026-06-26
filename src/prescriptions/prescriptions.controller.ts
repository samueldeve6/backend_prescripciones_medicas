import { Body, Controller, Post, UseGuards, Req, Get, Query, Param, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrescriptionsService } from './prescriptions.service.js';
import { CreatePrescriptionDto } from './dto/create-prescription.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard) // Protegemos todas las rutas de este controlador
export class PrescriptionsController {
    constructor(private readonly prescriptionsService: PrescriptionsService) {}

    // Registra una nueva prescripción médica con sus medicamentos asociados, vinculándola al ID del doctor autenticado que realiza la petición.
    @Post()
    @Roles('doctor') // Solo los doctores pueden crear recetas
    create(@Body() createPrescriptionDto: CreatePrescriptionDto, @Req() req) {
    // El 'sub' es el ID que viene en el token que ya probamos
    const userId = req.user.userId || req.user.sub;
    
    return this.prescriptionsService.create(createPrescriptionDto, userId);
    }

    // Permite a un paciente ver el listado de sus propias prescripciones
    @Get('me')
    @Roles('patient') // Solo los pacientes pueden acceder a su bandeja
    findMyPrescriptions(@Query() query: any, @Req() req: any) {
    console.log("=== DATOS DEL USUARIO EN EL TOKEN ===", req.user);
    return this.prescriptionsService.findMyPrescriptions(req.user.userId || req.user.sub, query);
    }

    // Obtiene el listado de prescripciones permitiendo filtrar si son propias (?mine=true), por su estado (pending/consumed) y aplicando paginación.
    @Get()
    @Roles('doctor', 'admin') 
    findAll(@Query() query: any, @Req() req: any) { 
        return this.prescriptionsService.findAll(query, req.user.userId || req.user.sub);
    }

    // Permite al doctor obtener la lista de pacientes para el selector del formulario
    @Get('patients/search')
    @Roles('doctor', 'admin')
    async searchPatients() {
    // Delegamos el trabajo al servicio
    return this.prescriptionsService.findAllPatients();
    }

    // Busca y retorna el detalle completo de una prescripción específica por su ID, incluyendo la lista de medicamentos, datos del paciente y del doctor.
    @Get(':id')
    @Roles('doctor', 'admin', 'patient')
    findOne(@Param('id') id: string) {
        return this.prescriptionsService.findOne(id);
    }

    // Permite a un paciente marcar una prescripción como consumida, cambiando su estado a "consumed". Solo el paciente asociado a la prescripción puede realizar esta acción.
    @Put(':id/consume')
    @Roles('patient') // Solo los pacientes pueden marcarla como consumida
    consume(@Param('id') id: string, @Req() req: any) {
    return this.prescriptionsService.consume(id, req.user.userId || req.user.sub);
    }

    // Genera y descarga un PDF con el detalle de la prescripción. Solo el paciente asociado a la prescripción puede descargar su PDF.
    @Get(':id/pdf')
    @Roles('patient') // Exigido por el contrato de la prueba
    async downloadPdf(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const pdfBuffer = await this.prescriptionsService.generatePdf(id, req.user.userId || req.user.sub);

    

    // Configurar las cabeceras HTTP para que el navegador entienda que es un PDF descargable
    res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=prescripcion-${id}.pdf`,
        'Content-Length': pdfBuffer.length,
    });

    // Enviar el buffer
    res.end(pdfBuffer);
    }
}
