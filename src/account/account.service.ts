import {Injectable} from "@nestjs/common";
import {prisma} from "../main";

@Injectable()
export class AccountService {
    getAccount() {
        return prisma.account.findFirst({
            where: {
                id: {
                    equals: ""
                }
            }
        })
    }
}
