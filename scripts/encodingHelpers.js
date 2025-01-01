export const decodeBase64ToLatin1 = atob;
export const decodeBase64ToBinary = base64EncodedString =>
    Uint8Array.from(atob(base64EncodedString), m => m.codePointAt(0));
export const decodeBase64ToUTF8 = base64EncodedString =>
    new TextDecoder().decode(decodeBase64ToBinary(base64EncodedString));
export const decodeBase64ToUTF8OrLatin1 = base64EncodedString => {
    try {
        return decodeBase64ToUTF8(base64EncodedString);
    } catch (e) {
        console.error(e, base64EncodedString)
        return decodeBase64ToLatin1(base64EncodedString);
    }
}
export function encodeUTF8AsBase64(str) {
    const encoder = new TextEncoder();

    const utf8 = encoder.encode(str);

    var binaryString = '';
    for (let b = 0; b < utf8.length; ++b) {
        binaryString += String.fromCharCode(utf8[b]);
    }

    return btoa(binaryString);
}
export function encodeUTF8OrLatin1AsBase64(str) {
    try {
        return encodeUTF8AsBase64(str);
    } catch (e) {
        console.error(e, str)
        return btoa(str);
    }
}