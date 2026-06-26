import PDFDocument from 'pdfkit';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePrescriptionDto } from './dto/create-prescription.dto.js';
import { randomBytes } from 'crypto';

@Injectable()
export class PrescriptionsService {
    constructor(private prisma: PrismaService) {}
    // Crear una nueva prescripción (Contrato 3)
    async create(dto: CreatePrescriptionDto, authorId: string) {

        // Genera un código aleatorio de 8 caracteres (ejemplo: RX-A1B2C3D4)
        const generatedCode =`RX-${randomBytes(4).toString('hex').toUpperCase()}`;

        return this.prisma.prescription.create({
            data: {
                code: generatedCode, // Usamos el código generado
                notes: dto.notes,
                status: 'pending',
                // Conexión con el médico (autor)
                author: { connect: { userId: authorId} },
                // Conexión con el paciente
                patient: { connect: { id: dto.patientId} },
                //Creación anidada de los items de la prescripción
                items: {
                    create: dto.items.map(item => ({
                        name: item.name,
                        dosage: item.dosage,
                        quantity: item.quantity,
                        instructions: item.instructions,
                    })),
                },
            },
            include: {
                items: true, // Para que la respuesta incluya los items creados de la prescripción
            },
        });
    }
  // Listar prescripciones con filtros y paginación (Contrato 4)
  async findAll(query: any, doctorUserId: string) {
    const { mine, status, page = 1, limit = 5, search } = query; // Cambiado default a 5 para emparejar frontend
    const skip = (page - 1) * limit;

    return this.prisma.prescription.findMany({
      where: {
        // Si mine=true o estás en el panel del doctor, filtramos por el médico logueado
        ...(mine === 'true' && { author: { userId: doctorUserId } }),
        ...(status && { status }), // Filtra por 'pending' o 'consumed'
        ...(search && {
          patient: {
            user: {
              name: {
                contains: search,
                mode: 'insensitive', // No importa mayúsculas/minúsculas
              },
            },
          },
        }),
      },
      include: {
        patient: { include: { user: { select: { name: true, email: true } } } },
        items: true, // ◄--- SOLUCIÓN AL "0": Ahora Prisma sí carga los medicamentos
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(skip),
    });
  }

  // Detalle de una prescripción (Contrato 4)
  async findOne(id: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        items: true, // Importante: incluir los medicamentos digitados
        patient: { include: { user: { select: { name: true, email: true } } } },
        author: { include: { user: { select: { name: true } } } },
      },
    });

    if (!prescription) throw new NotFoundException('Prescripción no encontrada');
    return prescription;
  }


  // Consumir una prescripción (Contrato 5)
  async consume(id: string, patientUserId: string) {
  // Verificamos que la receta exista y pertenezca al paciente logueado
  const prescription = await this.prisma.prescription.findUnique({
    where: { id },
    include: { patient: true },
  });

  if (!prescription) throw new NotFoundException('Prescripción no encontrada');
  
  if (prescription.patient.userId !== patientUserId) {
    throw new ForbiddenException('Esta prescripción no te pertenece');
  }

  return this.prisma.prescription.update({
      where: { id },
      data: {
        status: 'consumed',
        consumedAt: new Date(),
      },
    });
  }

  // Buscar solo las prescripciones que le pertenezcan al paciente 
  async findMyPrescriptions(patientUserId: string, query: any) {
  const { status, page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  return this.prisma.prescription.findMany({
      where: {
        patient: {
          userId: patientUserId, // Filtra estrictamente por el usuario logueado
        },
        ...(status && { status }), // Filtra por pending o consumed si viene en la URL
      },
      include: {
        items: true,
        author: { include: { user: { select: { name: true, email: true} } } }, // Para que el paciente vea el nombre de su doctor
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(skip),
    });
  }


  // Método para generar el PDF de una prescripción
  async generatePdf(id: string, patientUserId: string): Promise<Buffer> {
    // 1. Buscar la receta con sus ítems, doctor y paciente
    const prescription = await this.findOne(id);

    // 2. Validar que le pertenezca al paciente logueado
    if (prescription.patient.userId !== patientUserId) {
      throw new ForbiddenException('No tienes permiso para descargar esta prescripción');
    }

    // 3. Crear el documento PDF en memoria 
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // --- DISEÑO DEL PDF ---
      // Encabezado
      doc.fontSize(20).text('PRESCRIPCIÓN MÉDICA', { align: 'center' }).moveDown();
      doc.fontSize(12).text(`Código: ${prescription.code}`);
      doc.text(`Fecha: ${prescription.createdAt.toLocaleDateString()}`);
      doc.text(`Estado: ${prescription.status.toUpperCase()}`).moveDown();

      // Información de los actores
      doc.text(`Doctor: ${prescription.author.user.name} (${prescription.author.specialty || 'General'})`);
      doc.text(`Paciente: ${prescription.patient.user.name}`).moveDown();
      
      doc.text('--------------------------------------------------').moveDown();

      // Medicamentos (Items)
      doc.fontSize(14).text('Medicamentos Recetados:', { underline: true }).moveDown(0.5);
      
      prescription.items.forEach((item, index) => {
        doc.fontSize(12).text(`${index + 1}. ${item.name} - Cantidad: ${item.quantity}`);
        doc.fontSize(10).text(`   Dosis: ${item.dosage}`);
        doc.text(`   Instrucciones: ${item.instructions}`).moveDown();
      });

      if (prescription.notes) {
        doc.moveDown();
        doc.fontSize(12).text('Notas adicionales:', { underline: true }).moveDown(0.5);
        doc.fontSize(10).text(prescription.notes);
      }

      // Finalizar el documento
      doc.end();
    });
  }

  async findAllPatients() {
    return this.prisma.patient.findMany({
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    });
  }

}
