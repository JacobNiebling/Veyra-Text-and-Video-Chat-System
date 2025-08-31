import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterPage } from './register.component'; // <-- updated

describe('RegisterPage', () => { // <-- updated
  let component: RegisterPage;       // <-- updated
  let fixture: ComponentFixture<RegisterPage>; // <-- updated

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterPage] // standalone component can go here
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
