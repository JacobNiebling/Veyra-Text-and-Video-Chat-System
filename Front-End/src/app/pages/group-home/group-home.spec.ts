import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupHome } from './group-home';

describe('GroupHome', () => {
  let component: GroupHome;
  let fixture: ComponentFixture<GroupHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupHome]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GroupHome);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
