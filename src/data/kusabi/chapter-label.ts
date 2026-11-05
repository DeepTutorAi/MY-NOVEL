export const PROLOGUE_NUMBER = 0;
export const EPILOGUE_NUMBER = 13;

export function chapterLabel(number: number): string {
  if (number === PROLOGUE_NUMBER) return "บทนำ";
  if (number === EPILOGUE_NUMBER) return "บทส่งท้าย";
  return `บทที่ ${number}`;
}
