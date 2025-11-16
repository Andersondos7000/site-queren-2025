
import React, { useState } from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Info, CheckCircle, XCircle } from 'lucide-react';
import { validarCpf, formatarCpf, limparCpf } from "@/utils/cpfValidator";
import { validarCnpj, formatarCnpj, limparCnpj } from "@/utils/cnpjValidator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CEPInput } from "@/components/ui/CEPInput";
import { UseFormReturn } from 'react-hook-form';
import { z } from "zod";
import type { AddressData } from "@/hooks/useCEP";

const baseSchema = z.object({
  firstName: z.string().min(2, { message: "Nome deve ter pelo menos 2 caracteres" }),
  lastName: z.string().min(2, { message: "Sobrenome deve ter pelo menos 2 caracteres" }),
  email: z.string().email({ message: "Email inválido" }),
  personType: z.enum(["fisica", "juridica"]),
  cpf: z.string().min(1, { message: "CPF/CNPJ é obrigatório" }),
  country: z.string().min(2, { message: "País é obrigatório" }),
  zipCode: z.string().min(8, { message: "CEP deve ter pelo menos 8 caracteres" }),
  address: z.string().min(5, { message: "Endereço deve ter pelo menos 5 caracteres" }),
  number: z.string().min(1, { message: "Número é obrigatório" }),
  neighborhood: z.string().optional(),
  city: z.string().min(2, { message: "Cidade é obrigatória" }),
  state: z.string().min(2, { message: "Estado é obrigatório" }),
  phone: z.string().optional(),
});

const formSchema = baseSchema.superRefine((data, ctx) => {
  const { personType, cpf } = data;
  if (personType === 'fisica') {
    const cpfLimpo = limparCpf(cpf);
    if (cpfLimpo.length !== 11) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cpf'], message: 'CPF deve ter 11 dígitos' });
      return;
    }
    if (!validarCpf(cpf)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cpf'], message: 'CPF inválido' });
    }
  } else if (personType === 'juridica') {
    const cnpjLimpo = limparCnpj(cpf);
    if (cnpjLimpo.length !== 14) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cpf'], message: 'CNPJ deve ter 14 dígitos' });
      return;
    }
    if (!validarCnpj(cpf)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cpf'], message: 'CNPJ inválido' });
    }
  }
});

export type CustomerFormData = z.infer<typeof formSchema>;

interface CustomerInformationProps {
  form: UseFormReturn<any>;
}

const CustomerInformation: React.FC<CustomerInformationProps> = ({ form }) => {
  const [cpfStatus, setCpfStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const handleCpfChange = (value: string, onChange: (value: string) => void) => {
    const personType = form.getValues('personType');
    const docFormatado = personType === 'juridica' ? formatarCnpj(value) : formatarCpf(value);
    onChange(docFormatado);
    
    // Validar em tempo real conforme o tipo
    const len = (personType === 'juridica' ? limparCnpj(value).length : limparCpf(value).length);
    if (value.trim() === '' || (personType === 'juridica' ? len < 14 : len < 11)) {
      setCpfStatus('idle');
    } else {
      const isValid = personType === 'juridica' ? validarCnpj(value) : validarCpf(value);
      setCpfStatus(isValid ? 'valid' : 'invalid');
    }
  };

  const handleAddressFound = (addressData: AddressData) => {
    form.setValue('zipCode', addressData.cep);
    form.setValue('address', addressData.logradouro);
    form.setValue('neighborhood', addressData.bairro);
    form.setValue('city', addressData.cidade);
    form.setValue('state', addressData.estado);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Info className="h-5 w-5 text-butterfly-orange" />
          Informações do Cliente
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome*</FormLabel>
                <FormControl>
                  <Input placeholder="Digite seu nome" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sobrenome*</FormLabel>
                <FormControl>
                  <Input placeholder="Digite seu sobrenome" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email*</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Digite seu email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="personType"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Tipo de Pessoa*</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="flex flex-row space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fisica" id="fisica" />
                      <Label htmlFor="fisica">Pessoa Física</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="juridica" id="juridica" />
                      <Label htmlFor="juridica">Pessoa Jurídica</Label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  CPF/CNPJ*
                  {cpfStatus === 'valid' && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {cpfStatus === 'invalid' && (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder={form.getValues('personType') === 'juridica' ? '00.000.000/0000-00' : '000.000.000-00'} 
                    {...field}
                    onChange={(e) => handleCpfChange(e.target.value, field.onChange)}
                    className={`${
                      cpfStatus === 'valid' ? 'border-green-500 focus:border-green-500' :
                      cpfStatus === 'invalid' ? 'border-red-500 focus:border-red-500' :
                      ''
                    }`}
                  />
                </FormControl>
                {cpfStatus === 'valid' && (
                  <p className="text-sm text-green-600 mt-1">✓ {form.getValues('personType') === 'juridica' ? 'CNPJ' : 'CPF'} válido</p>
                )}
                {cpfStatus === 'invalid' && (
                  <p className="text-sm text-red-600 mt-1">✗ {form.getValues('personType') === 'juridica' ? 'CNPJ' : 'CPF'} inválido</p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>País*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um país" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Brasil">Brasil</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="zipCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CEP*</FormLabel>
                <FormControl>
                  <CEPInput
                    value={field.value}
                    onChange={field.onChange}
                    onAddressFound={handleAddressFound}
                    label=""
                    placeholder="00000-000"
                    error={form.formState.errors.zipCode?.message}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="md:col-span-2">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço*</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua, Avenida, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número*</FormLabel>
                <FormControl>
                  <Input placeholder="123" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <FormField
            control={form.control}
            name="neighborhood"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bairro (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Seu bairro" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade*</FormLabel>
                <FormControl>
                  <Input placeholder="Sua cidade" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="AC">AC</SelectItem>
                    <SelectItem value="AL">AL</SelectItem>
                    <SelectItem value="AP">AP</SelectItem>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="BA">BA</SelectItem>
                    <SelectItem value="CE">CE</SelectItem>
                    <SelectItem value="DF">DF</SelectItem>
                    <SelectItem value="ES">ES</SelectItem>
                    <SelectItem value="GO">GO</SelectItem>
                    <SelectItem value="MA">MA</SelectItem>
                    <SelectItem value="MT">MT</SelectItem>
                    <SelectItem value="MS">MS</SelectItem>
                    <SelectItem value="MG">MG</SelectItem>
                    <SelectItem value="PA">PA</SelectItem>
                    <SelectItem value="PB">PB</SelectItem>
                    <SelectItem value="PR">PR</SelectItem>
                    <SelectItem value="PE">PE</SelectItem>
                    <SelectItem value="PI">PI</SelectItem>
                    <SelectItem value="RJ">RJ</SelectItem>
                    <SelectItem value="RN">RN</SelectItem>
                    <SelectItem value="RS">RS</SelectItem>
                    <SelectItem value="RO">RO</SelectItem>
                    <SelectItem value="RR">RR</SelectItem>
                    <SelectItem value="SC">SC</SelectItem>
                    <SelectItem value="SP">SP</SelectItem>
                    <SelectItem value="SE">SE</SelectItem>
                    <SelectItem value="TO">TO</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Celular (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="(00) 00000-0000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerInformation;
