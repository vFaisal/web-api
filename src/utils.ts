import {customAlphabet} from "nanoid";


export function generateNanoId(size = 16): string {
    return customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", size)()
}

export function unixTimestamp() {
    return Math.round(Date.now() / 1000)
}
