import { Controller } from '@nestjs/common';
import { FederatedIdentitiesService } from './federated-identities.service';

@Controller('federated-identities')
export class FederatedIdentitiesController {
  constructor(private readonly federatedIdentitiesService: FederatedIdentitiesService) {}
}
