import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should return token on login', (done) => {
    service.login('test@test.com', '123456').subscribe(res => {
      expect(res.token).toBe('fake-jwt-token');
      done();
    });
  });

  it('should return token on register', (done) => {
    service.register('test@test.com', 'user', '123456').subscribe(res => {
      expect(res.token).toBe('fake-jwt-token');
      done();
    });
  });
});
