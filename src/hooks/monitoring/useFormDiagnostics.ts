import { useState, useEffect, useCallback, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useIntegratedMonitoring } from './useIntegratedMonitoring';
import { useBrowserToolsMonitoring } from './useBrowserToolsMonitoring';

// Tipos para diagnóstico de formulários
export interface FormDiagnosticData {
  fieldName: string;
  expectedValue: string;
  actualValue: string;
  domValue: string;
  isValid: boolean;
  hasError: boolean;
  errorMessage?: string;
  timestamp: Date;
}

export interface FormValidationIssue {
  id: string;
  fieldName: string;
  issue: 'value_mismatch' | 'validation_error' | 'dom_sync_error' | 'react_hook_form_error';
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestedFix: string;
  metadata: Record<string, unknown>;
}

export interface FormDiagnosticsConfig {
  enableRealTimeValidation: boolean;
  enableDOMSync: boolean;
  enableConsoleLogging: boolean;
  trackFieldChanges: boolean;
  alertOnValidationErrors: boolean;
}

const DEFAULT_CONFIG: FormDiagnosticsConfig = {
  enableRealTimeValidation: true,
  enableDOMSync: true,
  enableConsoleLogging: true,
  trackFieldChanges: true,
  alertOnValidationErrors: true
};

export interface UseFormDiagnosticsOptions {
  form: UseFormReturn<Record<string, unknown>>;
  config?: Partial<FormDiagnosticsConfig>;
  onIssueDetected?: (issue: FormValidationIssue) => void;
  onFieldMismatch?: (diagnostic: FormDiagnosticData) => void;
}

export interface UseFormDiagnosticsReturn {
  // Estado
  diagnostics: FormDiagnosticData[];
  issues: FormValidationIssue[];
  isMonitoring: boolean;
  
  // Controles
  startDiagnostics: () => void;
  stopDiagnostics: () => void;
  
  // Diagnóstico manual
  diagnoseField: (fieldName: string) => Promise<FormDiagnosticData>;
  diagnoseAllFields: () => Promise<FormDiagnosticData[]>;
  
  // Correções automáticas
  fixFieldSync: (fieldName: string) => Promise<boolean>;
  fixAllFieldSync: () => Promise<boolean>;
  
  // Relatórios
  generateReport: () => string;
  exportDiagnostics: () => string;
}

/**
 * Hook para diagnóstico avançado de formulários React Hook Form
 * Integra com sistema de monitoramento para detectar problemas de sincronização
 */
export const useFormDiagnostics = ({
  form,
  config: userConfig = {},
  onIssueDetected,
  onFieldMismatch
}: UseFormDiagnosticsOptions): UseFormDiagnosticsReturn => {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  
  // Estados
  const [diagnostics, setDiagnostics] = useState<FormDiagnosticData[]>([]);
  const [issues, setIssues] = useState<FormValidationIssue[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const issueIdCounter = useRef(0);
  
  // Hooks de monitoramento
  const { 
    startMonitoring: startIntegratedMonitoring,
    stopMonitoring: stopIntegratedMonitoring,
    takeSnapshot
  } = useIntegratedMonitoring({
    config: {
      enableBrowserTools: true,
      collectInterval: 2000
    }
  });
  
  const {
    startMonitoring: startBrowserMonitoring,
    stopMonitoring: stopBrowserMonitoring,
    getConsoleLogs,
    getConsoleErrors
  } = useBrowserToolsMonitoring({
    enableConsoleLogs: config.enableConsoleLogging,
    collectInterval: 1000
  });

  // Função para obter valor do DOM
  const getDOMValue = useCallback((fieldName: string): string => {
    try {
      // Tentar diferentes seletores
      const selectors = [
        `input[name="${fieldName}"]`,
        `textarea[name="${fieldName}"]`,
        `select[name="${fieldName}"]`,
        `[data-field="${fieldName}"]`,
        `[aria-label*="${fieldName}"]`
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector) as HTMLInputElement;
        if (element) {
          return element.value || '';
        }
      }
      
      // Tentar por role e nome
      const roleSelectors = [
        `[role="textbox"][aria-label*="${fieldName}"]`,
        `[role="textbox"][placeholder*="${fieldName}"]`
      ];
      
      for (const selector of roleSelectors) {
        const element = document.querySelector(selector) as HTMLInputElement;
        if (element) {
          return element.value || '';
        }
      }
      
      return 'DOM_ELEMENT_NOT_FOUND';
    } catch (error) {
      console.error(`[FormDiagnostics] Erro ao obter valor DOM para ${fieldName}:`, error);
      return 'DOM_ACCESS_ERROR';
    }
  }, []);

  // Função para diagnosticar um campo específico
  const diagnoseField = useCallback(async (fieldName: string): Promise<FormDiagnosticData> => {
    const formValues = form.getValues();
    const formErrors = form.formState.errors;
    const fieldState = form.getFieldState(fieldName);
    
    const expectedValue = formValues[fieldName] || '';
    const domValue = getDOMValue(fieldName);
    const actualValue = expectedValue;
    
    const diagnostic: FormDiagnosticData = {
      fieldName,
      expectedValue,
      actualValue,
      domValue,
      isValid: !fieldState.error,
      hasError: !!fieldState.error,
      errorMessage: fieldState.error?.message,
      timestamp: new Date()
    };
    
    // Detectar problemas
    if (expectedValue !== domValue && domValue !== 'DOM_ELEMENT_NOT_FOUND') {
      const issue: FormValidationIssue = {
        id: `sync_issue_${++issueIdCounter.current}`,
        fieldName,
        issue: 'dom_sync_error',
        description: `Valor do React Hook Form ("${expectedValue}") não coincide com valor do DOM ("${domValue}")`,
        severity: 'high',
        suggestedFix: 'Verificar se o campo está corretamente conectado ao React Hook Form',
        metadata: {
          reactValue: expectedValue,
          domValue,
          fieldState
        }
      };
      
      setIssues(prev => [...prev, issue]);
      onIssueDetected?.(issue);
      onFieldMismatch?.(diagnostic);
    }
    
    if (config.enableConsoleLogging) {
      console.log(`[FormDiagnostics] Campo ${fieldName}:`, {
        react: expectedValue,
        dom: domValue,
        valid: diagnostic.isValid,
        error: diagnostic.errorMessage
      });
    }
    
    return diagnostic;
  }, [form, getDOMValue, config.enableConsoleLogging, onIssueDetected, onFieldMismatch]);

  // Função para diagnosticar todos os campos
  const diagnoseAllFields = useCallback(async (): Promise<FormDiagnosticData[]> => {
    const formValues = form.getValues();
    const fieldNames = Object.keys(formValues);
    
    const diagnosticsPromises = fieldNames.map(fieldName => diagnoseField(fieldName));
    const results = await Promise.all(diagnosticsPromises);
    
    setDiagnostics(results);
    return results;
  }, [form, diagnoseField]);

  // Função para corrigir sincronização de campo
  const fixFieldSync = useCallback(async (fieldName: string): Promise<boolean> => {
    try {
      const domValue = getDOMValue(fieldName);
      
      if (domValue && domValue !== 'DOM_ELEMENT_NOT_FOUND' && domValue !== 'DOM_ACCESS_ERROR') {
        // Forçar atualização do React Hook Form com valor do DOM
        form.setValue(fieldName, domValue, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true
        });
        
        // Trigger revalidation
        await form.trigger(fieldName);
        
        if (config.enableConsoleLogging) {
          console.log(`[FormDiagnostics] Campo ${fieldName} sincronizado: "${domValue}"`);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`[FormDiagnostics] Erro ao corrigir sincronização do campo ${fieldName}:`, error);
      return false;
    }
  }, [form, getDOMValue, config.enableConsoleLogging]);

  // Função para corrigir sincronização de todos os campos
  const fixAllFieldSync = useCallback(async (): Promise<boolean> => {
    const formValues = form.getValues();
    const fieldNames = Object.keys(formValues);
    
    const results = await Promise.all(
      fieldNames.map(fieldName => fixFieldSync(fieldName))
    );
    
    return results.every(result => result);
  }, [form, fixFieldSync]);

  // Função para iniciar diagnósticos
  const startDiagnostics = useCallback(() => {
    if (isMonitoring) return;
    
    setIsMonitoring(true);
    startIntegratedMonitoring();
    startBrowserMonitoring();
    
    if (config.trackFieldChanges) {
      intervalRef.current = setInterval(() => {
        diagnoseAllFields();
      }, 3000); // Verificar a cada 3 segundos
    }
    
    if (config.enableConsoleLogging) {
      console.log('[FormDiagnostics] Diagnósticos iniciados');
    }
  }, [isMonitoring, startIntegratedMonitoring, startBrowserMonitoring, config, diagnoseAllFields]);

  // Função para parar diagnósticos
  const stopDiagnostics = useCallback(() => {
    if (!isMonitoring) return;
    
    setIsMonitoring(false);
    stopIntegratedMonitoring();
    stopBrowserMonitoring();
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (config.enableConsoleLogging) {
      console.log('[FormDiagnostics] Diagnósticos parados');
    }
  }, [isMonitoring, stopIntegratedMonitoring, stopBrowserMonitoring, config.enableConsoleLogging]);

  // Função para gerar relatório
  const generateReport = useCallback((): string => {
    const report = {
      timestamp: new Date().toISOString(),
      totalFields: diagnostics.length,
      validFields: diagnostics.filter(d => d.isValid).length,
      invalidFields: diagnostics.filter(d => !d.isValid).length,
      syncIssues: diagnostics.filter(d => d.expectedValue !== d.domValue).length,
      issues: issues.length,
      diagnostics,
      issues
    };
    
    return JSON.stringify(report, null, 2);
  }, [diagnostics, issues]);

  // Função para exportar diagnósticos
  const exportDiagnostics = useCallback((): string => {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      diagnostics,
      issues
    }, null, 2);
  }, [diagnostics, issues]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    // Estado
    diagnostics,
    issues,
    isMonitoring,
    
    // Controles
    startDiagnostics,
    stopDiagnostics,
    
    // Diagnóstico manual
    diagnoseField,
    diagnoseAllFields,
    
    // Correções automáticas
    fixFieldSync,
    fixAllFieldSync,
    
    // Relatórios
    generateReport,
    exportDiagnostics
  };
};

export default useFormDiagnostics;