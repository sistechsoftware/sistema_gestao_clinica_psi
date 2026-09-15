import { describe, expect, it } from 'vitest';
import { isValidCPF, maskCPF, normalizeCPF, randomValidCPF } from './cpf.js';

describe('cpf', () => {
  it('valida CPF correto', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true);
  });

  it('rejeita dígitos verificadores errados e sequências repetidas', () => {
    expect(isValidCPF('529.982.247-24')).toBe(false);
    expect(isValidCPF('111.111.111-11')).toBe(false);
    expect(isValidCPF('123')).toBe(false);
  });

  it('normaliza e mascara', () => {
    expect(normalizeCPF('529.982.247-25')).toBe('52998224725');
    expect(maskCPF('52998224725')).toBe('***.***.725-**');
  });

  it('gera CPFs válidos aleatórios (para seed/testes)', () => {
    for (let i = 0; i < 20; i++) {
      expect(isValidCPF(randomValidCPF())).toBe(true);
    }
  });
});
