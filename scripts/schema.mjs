// Quy ước dữ liệu dùng chung cho validate.mjs (kiểm tra) và generate.mjs (sinh câu hỏi).

// Phần rank trong id: "and-jun-q01" (Flutter không có tiền tố track: "jun-q01").
export const PREFIX = { fresher: "fre", junior: "jun", middle: "mid", senior: "sen" };

// Đáp án tham chiếu đáp án khác sẽ sai nghĩa khi app xáo trộn thứ tự.
export const CROSS_REF = /(tất cả (các )?(đáp án|phương án|ý) trên|cả [A-D] và [A-D]|\b[A-D] và [A-D]\b|không (có )?(đáp án|phương án) nào|all of the above|none of the above|cả hai (đáp án|phương án))/i;

// Chuẩn hoá câu chữ để phát hiện câu hỏi / đáp án trùng nhau.
export const norm = (s) => s.toLowerCase().replace(/[`'"?.,:;!()\-–—]/g, "").replace(/\s+/g, " ").trim();
