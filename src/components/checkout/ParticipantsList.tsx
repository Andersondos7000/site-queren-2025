
import React, { useState } from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Info, Upload, CheckCircle, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from 'react-hook-form';
import BulkParticipantsModal from './BulkParticipantsModal';
import { validarCpf, formatarCpf, limparCpf } from "@/utils/cpfValidator";

interface ParticipantsListProps {
  form: UseFormReturn<any>;
  participantCount: number;
  onAddParticipant: () => void;
  onRemoveParticipant: (index: number) => void;
  onImportParticipants?: (participants: any[]) => void;
}

const ParticipantsList: React.FC<ParticipantsListProps> = ({ 
  form, 
  participantCount, 
  onAddParticipant, 
  onRemoveParticipant,
  onImportParticipants 
}) => {
  const [cpfStatuses, setCpfStatuses] = useState<Record<number, 'idle' | 'valid' | 'invalid'>>({});

  const handleParticipantCpfChange = (index: number, value: string, onChange: (value: string) => void) => {
    // Formatar CPF automaticamente
    const cpfFormatado = formatarCpf(value);
    onChange(cpfFormatado);
    
    // Validar CPF em tempo real (apenas se não estiver vazio, já que é opcional)
    if (value.trim() === '') {
      setCpfStatuses(prev => ({ ...prev, [index]: 'idle' }));
    } else if (limparCpf(value).length >= 11) {
      const isValid = validarCpf(value);
      setCpfStatuses(prev => ({ ...prev, [index]: isValid ? 'valid' : 'invalid' }));
    } else {
      setCpfStatuses(prev => ({ ...prev, [index]: 'idle' }));
    }
  };
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Info className="h-5 w-5 text-butterfly-orange" />
            Participantes
          </h2>
          <div className="flex gap-2">
            {onImportParticipants && (
              <BulkParticipantsModal onImportParticipants={onImportParticipants}>
                <Button 
                  type="button"
                  variant="outline"
                  className="border-orange-500 text-orange-500 hover:bg-orange-50 text-sm sm:text-base"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Importar em Massa
                </Button>
              </BulkParticipantsModal>
            )}
            <Button type="button" variant="outline" onClick={onAddParticipant}>
              Adicionar Participante
            </Button>
          </div>
        </div>

        {Array.from({ length: participantCount }).map((_, index) => (
          <div key={`participant-${index}`} className="border p-4 rounded-md mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Participante {index + 1}</h3>
              {index > 0 && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => onRemoveParticipant(index)}
                  className="h-8 text-red-500 hover:text-red-700"
                >
                  Remover
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name={`participants.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Participante (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do participante" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`participants.${index}.cpf`}
                render={({ field }) => {
                  const currentStatus = cpfStatuses[index] || 'idle';
                  return (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        CPF do Participante (opcional)
                        {currentStatus === 'valid' && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        {currentStatus === 'invalid' && (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="000.000.000-00" 
                          {...field}
                          onChange={(e) => handleParticipantCpfChange(index, e.target.value, field.onChange)}
                          className={`${
                            currentStatus === 'valid' ? 'border-green-500 focus:border-green-500' :
                            currentStatus === 'invalid' ? 'border-red-500 focus:border-red-500' :
                            ''
                          }`}
                        />
                      </FormControl>
                      <FormMessage />
                      {currentStatus === 'valid' && (
                        <p className="text-sm text-green-600 mt-1">✓ CPF válido</p>
                      )}
                      {currentStatus === 'invalid' && (
                        <p className="text-sm text-red-600 mt-1">✗ CPF inválido</p>
                      )}
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name={`participants.${index}.tshirt`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Camiseta (T-shirt)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tamanho" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        <SelectItem value="PP">PP</SelectItem>
                        <SelectItem value="P">P</SelectItem>
                        <SelectItem value="M">M</SelectItem>
                        <SelectItem value="G">G</SelectItem>
                        <SelectItem value="GG">GG</SelectItem>
                        <SelectItem value="EXGG">EXGG</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`participants.${index}.dress`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vestido</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tamanho" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        <SelectItem value="0">0</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                        <SelectItem value="6">6</SelectItem>
                        <SelectItem value="8">8</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="12">12</SelectItem>
                        <SelectItem value="14">14</SelectItem>
                        <SelectItem value="16">16</SelectItem>
                        <SelectItem value="18">18</SelectItem>
                        <SelectItem value="GG">GG</SelectItem>
                        <SelectItem value="EXGG">EXGG</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ParticipantsList;
