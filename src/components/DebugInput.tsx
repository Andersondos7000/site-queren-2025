import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const testSchema = z.object({
  username: z.string().min(3, { message: "Nome de usuário deve ter pelo menos 3 caracteres" }),
});

type TestFormValues = z.infer<typeof testSchema>;

const DebugInput = () => {
  const [nativeValue, setNativeValue] = useState('');
  const [directInputValue, setDirectInputValue] = useState('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const form = useForm<TestFormValues>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      username: "",
    },
  });

  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${info}`]);
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNativeValue(value);
    addDebugInfo(`Native input changed: "${value}"`);
  };

  const handleDirectInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDirectInputValue(value);
    addDebugInfo(`Direct Input component changed: "${value}"`);
  };

  const watchedUsername = form.watch('username');

  return (
    <div className="p-6 border rounded-lg bg-gray-50 space-y-4">
      <h3 className="text-lg font-semibold">Debug de Input - Teste de Digitação</h3>
      
      {/* Input HTML Nativo */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">1. Input HTML Nativo:</label>
        <input
          type="text"
          value={nativeValue}
          onChange={handleNativeChange}
          placeholder="Digite aqui (nativo)"
          className="w-full p-2 border rounded"
        />
        <p className="text-xs text-gray-600">Valor: "{nativeValue}"</p>
      </div>

      {/* Input Component Direto */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">2. Componente Input Direto:</label>
        <Input
          value={directInputValue}
          onChange={handleDirectInputChange}
          placeholder="Digite aqui (Input component)"
        />
        <p className="text-xs text-gray-600">Valor: "{directInputValue}"</p>
      </div>

      {/* React Hook Form com FormField */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">3. React Hook Form + FormField:</label>
        <Form {...form}>
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input 
                    placeholder="Digite aqui (FormField)"
                    {...field}
                    onChange={(e) => {
                      addDebugInfo(`FormField onChange called: "${e.target.value}"`);
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
        <p className="text-xs text-gray-600">Valor do form: "{watchedUsername}"</p>
      </div>

      {/* Controller direto */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">4. Controller Direto:</label>
        <Controller
          name="username"
          control={form.control}
          render={({ field }) => {
            return (
              <Input
                placeholder="Digite aqui (Controller)"
                value={field.value}
                onChange={(e) => {
                  addDebugInfo(`Controller onChange: "${e.target.value}"`);
                  field.onChange(e.target.value);
                }}
              />
            );
          }}
        />
      </div>

      {/* Informações de Debug */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Debug Log:</h4>
        <div className="bg-black text-green-400 p-2 rounded text-xs font-mono max-h-32 overflow-y-auto">
          {debugInfo.length === 0 ? (
            <p>Nenhum evento ainda...</p>
          ) : (
            debugInfo.map((info, index) => (
              <p key={`${info.slice(0, 20)}-${index}`}>{info}</p>
            ))
          )}
        </div>
      </div>

      {/* Botões de Teste */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            form.setValue('username', 'teste_programatico');
            addDebugInfo('Valor definido programaticamente');
          }}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
        >
          Definir Valor Programático
        </button>
        <button
          onClick={() => {
            form.reset();
            setNativeValue('');
            setDirectInputValue('');
            setDebugInfo([]);
            addDebugInfo('Formulário resetado');
          }}
          className="px-3 py-1 bg-red-500 text-white rounded text-sm"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default DebugInput;